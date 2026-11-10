'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronRight } from 'lucide-react';

// ─── SUB-COMPONENTS FROM REDSERVICIOS/TRANSPORTE ────────────────────────────

function ChangeView({ bounds }: { bounds: L.LatLngBounds | null }) {
    const map = useMap();
    useEffect(() => {
        if (bounds && bounds.isValid() && map) {
            try {
                map.fitBounds(bounds, { padding: [100, 100], animate: true, duration: 1 });
            } catch (e) {}
        }
    }, [bounds, map]);
    return null;
}

function FlyToOrigin({ origin }: { origin: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (origin && map) {
            try {
                map.flyTo(origin, Math.max(map.getZoom(), 14), { animate: true, duration: 1.2 });
            } catch (e) {}
        }
    }, [origin, map]);
    return null;
}

// ─── MAIN PROVIDER MAP ──────────────────────────────────────────────────────

export default function TravelMap({ currentCoords, stops, currentStopIndex, setRoutePoints, currentRoutePoints, setIsRouteLoading, vehicleType }: any) {
    const [icons, setIcons] = useState<any>({});
    const [streetRoute, setStreetRoute] = useState<[number, number][]>([]);

    // Initialize Premium Icons
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const car = L.divIcon({
                className: 'custom-car-icon',
                html: `<div style="background-color: #0f172a; padding: 6px; border-radius: 12px; border: 2px solid white; box-shadow: 0 5px 20px rgba(0,0,0,0.4); transition: transform 0.3s ease-out;"><svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.28 5.42 5.08 6.01L3 12V20C3 20.55 3.45 21 4 21H5C5.55 21 6 20.55 6 20V19H18V20C18 20.55 18.45 21 19 21H20C20.55 21 21 20.55 21 20V12L18.92 6.01ZM6.5 7H17.5L18.53 10H5.47L6.5 7ZM19 17H5V12H19V17ZM7.5 14C6.67 14 6 14.67 6 15.5C6 16.33 6.67 17 7.5 17C8.33 17 9 16.33 9 15.5C9 14.67 8.33 14 7.5 14ZM16.5 14C15.67 14 15 14.67 15 15.5C15 16.33 15.67 17 16.5 17C17.33 17 18 16.33 18 15.5C18 14.67 17.33 14 16.5 14Z"/></svg></div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            const stopIcons = stops.map((s: any, i: number) => {
                const isActive = i === currentStopIndex;
                const color = isActive ? '#4f46e5' : '#cbd5e1';
                return L.divIcon({
                    className: 'custom-stop-icon',
                    html: `<div style="width: 12px; height: 12px; background: ${color}; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.2);"></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                });
            });

            setIcons({ car, stopIcons });
        }
    }, [stops, currentStopIndex]);

    // Fetch Route with Reliability Mirrors (Cloned from user side)
    useEffect(() => {
        const fetchRoute = async () => {
            setIsRouteLoading(true);
            const target = stops[currentStopIndex];
            const [startLat, startLon] = [currentCoords.lat, currentCoords.lng];
            const [endLat, endLon] = [target.lat, target.lng];
            
            const mirrors = [
                `/api/routing/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`,
                `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`
            ];

            let success = false;
            for (const url of mirrors) {
                try {
                    const res = await fetch(url);
                    if (!res.ok) continue;
                    const data = await res.json();
                    if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
                        const pts = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
                        setRoutePoints(pts);
                        success = true;
                        break;
                    }
                } catch (e) {}
            }
            if (!success) setRoutePoints([[startLat, startLon], [endLat, endLon]]);
            setIsRouteLoading(false);
        };
        fetchRoute();
    }, [currentStopIndex, currentCoords.lat, currentCoords.lng, stops, setRoutePoints, setIsRouteLoading]);

    // Bounds Calculation (Memoized for performance)
    const bounds = useMemo(() => {
        if (currentCoords && stops) {
            try {
                const pts = [[currentCoords.lat, currentCoords.lng], ...stops.map((s: any) => [s.lat, s.lng])];
                return L.latLngBounds(pts as L.LatLngExpression[]);
            } catch (e) { return null; }
        }
        return null;
    }, [currentCoords, stops]);

    if (!currentCoords?.lat || !currentCoords?.lng) return null;

    return (
        <div className="h-full w-full relative">
            <MapContainer 
                key={`map-provider-${stops.length}-${currentStopIndex}`}
                center={[currentCoords.lat, currentCoords.lng]} 
                zoom={14} 
                zoomControl={false}
                className="h-full w-full"
            >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                
                {/* Vehicle Marker */}
                {icons.car && (
                    <Marker position={[currentCoords.lat, currentCoords.lng]} icon={icons.car} zIndexOffset={1000} />
                )}
                
                {/* Stops Markers with Premium Tooltips */}
                {stops.map((s: any, i: number) => (
                    <Marker key={i} position={[s.lat, s.lng]} icon={icons.stopIcons?.[i] || L.divIcon({})}>
                        <Tooltip permanent direction="right" offset={[15, 0]} className="uber-tooltip">
                            <div className="flex items-center gap-2">
                                <span className="truncate max-w-[120px]">{s.name.split(':')[0]}</span>
                                <ChevronRight className="w-3 h-3 text-slate-300" />
                            </div>
                        </Tooltip>
                    </Marker>
                ))}

                {/* Street Route Line */}
                {currentRoutePoints.length > 0 && (
                    <>
                        <Polyline positions={currentRoutePoints} color="#0f172a" weight={10} opacity={0.1} />
                        <Polyline positions={currentRoutePoints} color="#0f172a" weight={5} opacity={0.9} lineJoin="round" lineCap="round" />
                        <Polyline positions={currentRoutePoints} color="#FFFFFF" weight={1} opacity={1} dashArray="8, 16" />
                    </>
                )}

                {bounds ? <ChangeView bounds={bounds} /> : <FlyToOrigin origin={[currentCoords.lat, currentCoords.lng]} />}
            </MapContainer>
            
            <style jsx global>{`
                .leaflet-container { background: #F0F2F5 !important; outline: none; }
                .leaflet-control-attribution { display: none !important; }
                
                .uber-tooltip {
                    background: white !important;
                    border: 1px solid #f1f5f9 !important;
                    border-radius: 999px !important;
                    padding: 8px 16px !important;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.12) !important;
                    font-size: 11px !important;
                    font-weight: 900 !important;
                    text-transform: uppercase !important;
                    color: #0f172a !important;
                    letter-spacing: 0.02em !important;
                }
                .leaflet-tooltip-left:before, .leaflet-tooltip-right:before {
                    display: none !important;
                }
            `}</style>
        </div>
    );
}
