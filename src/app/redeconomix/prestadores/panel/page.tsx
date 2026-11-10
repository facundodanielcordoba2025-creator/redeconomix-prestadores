'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useUser, useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where, limit, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Preferences } from '@capacitor/preferences';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { 
    User, Locate, Play, StopCircle, Package, ShieldCheck, Zap, 
    ChevronLeft, Navigation, MapPin, X, Phone, MessageSquare, CheckCircle2,
    Map as MapIcon, Loader2, DollarSign, QrCode, Share2, Wallet, CreditCard, Banknote, ChevronRight,
    Car, Truck, Pill, Pizza, Wrench, CreditCard as CardIcon, Star, Bike, Shield, Radio, Share, Users, Calendar, Timer, Ticket, ShieldAlert,
    Search, Plus
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import dynamic from 'next/dynamic';

const TravelMap = dynamic(() => import('./TravelMap'), { ssr: false });

export default function PrestadorPanelPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const userDocRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userData } = useDoc(userDocRef);
    const isPreventista = Boolean(userData?.services?.includes('Preventista') || userData?.categories?.includes('Preventista'));
    const { toast } = useToast();
    
    // REAL DATA QUERIES
    const servicesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, "serviceRequests"), 
            where("status", "in", ["sent", "pending", "searching"])
        );
    }, [firestore]);
    const { data: serviceRequests } = useCollection(servicesQuery);

    const routesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, "deliveryRoutes"),
            where("status", "==", "pending")
        );
    }, [firestore]);
    const { data: routes } = useCollection(routesQuery);
    
    const wholesaleOrdersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, "orders_wholesaler"),
            where("status", "==", "awaiting_provider")
        );
    }, [firestore]);
    const { data: wholesaleOrders } = useCollection(wholesaleOrdersQuery);

    const catalogQuery = useMemoFirebase(() => {
        if (!firestore || !isPreventista) return null;
        return query(collection(firestore, 'wholesale_products'), limit(15));
    }, [firestore, isPreventista]);
    const { data: catalogProducts } = useCollection<any>(catalogQuery);

    // Persistent Global Connection Status
    const [isConnected, setIsConnected] = useState(false);
    const [safetyAccepted, setSafetyAccepted] = useState(false);

    useEffect(() => {
        const loadSavedState = async () => {
            try {
                const [statusRes, safetyRes] = await Promise.all([
                    Preferences.get({ key: 'rex_provider_online_status' }),
                    Preferences.get({ key: 'rex_carpool_provider_safety_accepted' })
                ]);
                if (statusRes.value !== null) {
                    setIsConnected(statusRes.value === 'true');
                } else if (userData?.availability) {
                    setIsConnected(userData.availability === 'available');
                }
                setSafetyAccepted(safetyRes.value === 'true');
            } catch (e) {
                console.error("Preferences load error", e);
            }
        };
        loadSavedState();
    }, [userData?.availability]);

    const toggleConnection = async (nextState: boolean) => {
        setIsConnected(nextState);
        try {
            await Preferences.set({ key: 'rex_provider_online_status', value: nextState.toString() });
        } catch (e) {
            console.error("Preferences save error", e);
        }
        if (firestore && user) {
            try {
                await updateDoc(doc(firestore, 'users', user.uid), {
                    availability: nextState ? 'available' : 'offline',
                    updatedAt: serverTimestamp()
                });
            } catch (e) {
                console.error("Error syncing availability to Firestore:", e);
            }
        }
    };

    const [activeTab, setActiveTab] = useState("radar");
    const [coords, setCoords] = useState<{lat: number, lng: number}>({ lat: -24.7859, lng: -65.4117 });
    const [activeJob, setActiveJob] = useState<any>(null);
    const [isTestDriving, setIsTestDriving] = useState(false);
    // Service Form
    const [searchQuery, setSearchQuery] = useState("");

    // User role/service detection
    
    // GPS Tracking linked to Terminal Status
    useEffect(() => {
        let activeWatchId: string | null = null;

        const startTracking = async () => {
            try {
                if (Capacitor.isNativePlatform()) {
                    const perm = await Geolocation.requestPermissions();
                    if (perm.location !== 'granted') {
                        toast({ variant: "destructive", title: "PERMISO DENEGADO", description: "Debes habilitar la ubicación nativa para trabajar." });
                        setIsConnected(false);
                        return;
                    }
                }

                toast({ title: "GPS ACTIVADO", description: "Tu ubicación ahora es visible para la red de servicios.", className: "bg-primary text-white rounded-3xl" });
                
                activeWatchId = await Geolocation.watchPosition(
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
                    (position, err) => {
                        if (err) {
                            console.warn("GPS Warning:", err.message);
                            toast({ title: "BUSCANDO SEÑAL", description: "Estamos intentando precisar tu ubicación...", className: "bg-primary text-white rounded-3xl" });
                        } else if (position) {
                            setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
                        }
                    }
                );
            } catch (err: any) {
                console.error("Capacitor Geolocation Error:", err);
                setIsConnected(false);
            }
        };

        if (isConnected && typeof window !== 'undefined') {
            startTracking();
        }

        return () => {
            if (activeWatchId !== null) {
                Geolocation.clearWatch({ id: activeWatchId });
            }
        };
    }, [isConnected, toast]);
    const [currentRoutePoints, setCurrentRoutePoints] = useState<any[]>([]);
    const [routeStepIndex, setRouteStepIndex] = useState(0);
    const [isRouteLoading, setIsRouteLoading] = useState(false);
    
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentStep, setPaymentStep] = useState<'selection' | 'qr' | 'transfer' | 'rating'>('selection');
    const [rating, setRating] = useState(0);
    const [showSafetyDialog, setShowSafetyDialog] = useState(false);
    const [pendingJob, setPendingJob] = useState<any>(null);

    useEffect(() => {
        let interval: any;
        if (isTestDriving && currentRoutePoints.length > 0) {
            interval = setInterval(() => {
                setRouteStepIndex(prev => {
                    const next = prev + 1;
                    if (next < currentRoutePoints.length) {
                        setCoords({ lat: currentRoutePoints[next][0], lng: currentRoutePoints[next][1] });
                        return next;
                    }
                    setIsTestDriving(false);
                    return prev;
                });
            }, 80); 
        }
        return () => clearInterval(interval);
    }, [isTestDriving, currentRoutePoints]);

    const scenarios = useMemo(() => {
        const items: any[] = [];
        
        if (serviceRequests) {
            serviceRequests.forEach((s: any) => {
                const isMoto = (s.serviceType || '').toLowerCase().includes('moto');
                const rawPrice = s.totalPrice ?? s.agreedPrice ?? 0;
                items.push({
                    id: s.id,
                    name: s.serviceType || 'Viaje / Servicio',
                    icon: isMoto ? <Bike className="text-primary" /> : <Car className="text-primary" />,
                    vehicle: isMoto ? 'bike' : 'car',
                    fee: typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace(/[^0-9.-]+/g,"")) || 0,
                    type: isMoto ? 'MOTO TAXI' : 'VIAJE',
                    stops: [
                        { lat: s.originCoords?.[0] || -24.7821, lng: s.originCoords?.[1] || -65.4233, name: `RECOGER: ${s.origin || s.address || 'Origen'}` },
                        { lat: s.destCoords?.[0] || -24.7892, lng: s.destCoords?.[1] || -65.4103, name: `DESTINO: ${s.destination || s.destinationAddress || 'Destino'}` }
                    ]
                });
            });
        }
        
        // Logistics Routes
        if (routes) {
            routes.forEach((r: any) => {
                items.push({
                    id: r.id,
                    name: 'RUTA LOGÍSTICA',
                    icon: <Truck className="text-primary" />,
                    vehicle: 'truck',
                    fee: r.fee || 2500,
                    type: 'LOGÍSTICA',
                    stops: [
                        { lat: -24.7821, lng: -65.4233, name: `RETIRO: ${r.wholesalerName || 'Mayorista'}` },
                        { lat: -24.7892, lng: -65.4103, name: `ENTREGA: ${r.stops?.[0]?.address || 'Destino'}` }
                    ]
                });
            });
        }

        return items;
    }, [serviceRequests, routes, wholesaleOrders]);

    const handleAcceptJob = (job: any) => {
        if ((userData?.walletBalance || 0) <= -20000) {
            toast({ title: 'Cuenta Bloqueada', description: 'No puedes aceptar más viajes. Por favor realiza una rendición de fondos.', variant: 'destructive' });
            return;
        }
        // Todo: Add any dynamic safety checks if needed based on real job.type
        proceedWithJob(job);
    };

    const acceptSafetyTermsProvider = async () => {
        setSafetyAccepted(true);
        try {
            await Preferences.set({ key: 'rex_carpool_provider_safety_accepted', value: 'true' });
        } catch (e) {
            console.error("Failed to save safety terms:", e);
        }
        setShowSafetyDialog(false);
        if (pendingJob) {
            proceedWithJob(pendingJob);
        }
    };

    const proceedWithJob = async (job: any) => {
        if (!firestore || !user) return;
        setShowSafetyDialog(false);
        setIsRouteLoading(true);
        try {
            const providerDetails = {
                providerId: user.uid,
                providerName: userData?.fullName || [userData?.firstName, userData?.lastName].filter(Boolean).join(' ') || user?.displayName || 'Prestador',
                providerPhone: userData?.phone || user?.phoneNumber || '',
                providerVehicle: userData?.vehicleModel || '',
                providerPlate: userData?.vehiclePlate || '',
                updatedAt: serverTimestamp()
            };
            if (job.name === 'RUTA LOGÍSTICA') {
                await updateDoc(doc(firestore, "deliveryRoutes", job.id), {
                    status: 'assigned',
                    carrierId: user.uid,
                    ...providerDetails
                });
            } else {
                await updateDoc(doc(firestore, "serviceRequests", job.id), {
                    status: 'confirmed',
                    ...providerDetails
                });
            }
            toast({ title: "Misión Aceptada", description: "Dirígete a la ruta en Servicios Activos.", className: "bg-primary text-white rounded-3xl" });
            window.location.href = '/redeconomix/prestadores/servicios-activos';
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "No se pudo aceptar el trabajo.", variant: "destructive" });
        } finally {
            setIsRouteLoading(false);
        }
    };

    if (isUserLoading) return <div className="flex justify-center items-center h-screen bg-white"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

    return (
        <div className="flex flex-col min-h-screen bg-white font-sans text-slate-900 relative overflow-hidden">
            {!activeJob && (
                <>
                    <div className="sticky top-0 z-[2000] bg-white/90 backdrop-blur-md px-4 md:px-8 py-6 flex flex-col gap-4 border-b border-slate-50">
                        <div className="flex flex-col items-center justify-center w-full py-4 gap-5">
                            <span className={cn(
                                "text-sm font-black uppercase tracking-widest transition-colors", 
                                isConnected ? "text-red-600" : "text-slate-500"
                            )}>
                                {isConnected ? "TERMINAL ONLINE" : "ENCENDER TERMINAL"}
                            </span>
                            <Switch 
                                checked={isConnected} 
                                onCheckedChange={toggleConnection} 
                                className="data-[state=checked]:bg-red-600 scale-[3.5] mt-6 mb-4" 
                            />
                        </div>

                        {/* WALLET / SALDO BLOCK */}
                        <div className="mt-6 mb-4">
                            <Card className={cn("rounded-2xl p-6 border-none text-white shadow-xl", (userData?.walletBalance || 0) < -15000 ? "bg-slate-900 shadow-slate-900/20" : "bg-red-600 shadow-red-600/20")}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Billetera de Cobros</p>
                                        <h3 className="text-2xl font-black mt-1">${(userData?.walletBalance || 0).toLocaleString('es-AR')}</h3>
                                        <p className="text-xs font-medium text-white/70 mt-2">Límite de Riesgo: -$20.000</p>
                                    </div>
                                    <Wallet className="w-12 h-12 text-white" />
                                </div>
                            </Card>
                            {(userData?.walletBalance || 0) <= -20000 && (
                                <div className="mt-4 p-4 rounded-xl bg-slate-900 border-none text-white flex items-start gap-3 shadow-xl shadow-slate-900/20">
                                    <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                                    <div>
                                        <p className="text-sm font-bold uppercase tracking-tight text-red-500">CUENTA BLOQUEADA POR SALDO</p>
                                        <p className="text-xs font-medium mt-1 leading-relaxed text-slate-300">Alcanzaste el límite de dinero físico recaudado. Para seguir recibiendo viajes que requieran cobro en efectivo, por favor transferí el saldo a la plataforma.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>


                    <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4 md:px-8 py-4 flex-1">
                        {!isPreventista ? (
                            <>
                                <TabsList className="bg-slate-200 rounded-2xl h-14 p-1.5 mb-10 w-full gap-1">
                                    <TabsTrigger value="radar" className="flex-1 rounded-xl font-black uppercase text-[11px] tracking-widest text-slate-500 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-red-200 transition-all h-full">RADAR DE MISIONES</TabsTrigger>
                                    <TabsTrigger value="agendados" className="flex-1 rounded-xl font-black uppercase text-[11px] tracking-widest text-slate-500 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-red-200 transition-all h-full">PROGRAMADOS</TabsTrigger>
                                </TabsList>

                                <TabsContent value="radar" className="grid grid-cols-1 gap-6">
                                    {scenarios.map((job) => (
                                        <Card key={job.id} className={cn("rounded-2xl bg-white border border-slate-100 shadow-xl p-5 md:p-6 overflow-hidden cursor-pointer group hover:scale-[1.01] transition-all")} onClick={() => handleAcceptJob(job)}>
                                            <div className="flex items-center justify-between mb-5">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0", "bg-red-50 text-red-500")}>{job.icon}</div>
                                                    <div>
                                                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-tight">{job.name}</h4>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <p className="text-[9px] font-black uppercase tracking-widest text-red-600">{job.type}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right pl-2 shrink-0"><p className="text-xl font-black text-slate-900">${job.fee}</p></div>
                                            </div>
                                            <div className="flex gap-3 mt-4">
                                                <Button className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] shadow-lg transition-all bg-primary hover:bg-red-700 text-white">ACEPTAR AHORA</Button>
                                            </div>
                                        </Card>
                                    ))}
                                </TabsContent>

                                <TabsContent value="agendados" className="py-10 text-center space-y-6">
                                    <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-6"><Calendar className="h-10 w-10 text-slate-300" /></div>
                                    <h3 className="text-xl font-black uppercase tracking-tighter text-slate-400">PLANIFICÁ TU SEMANA</h3>
                                    <p className="text-xs text-slate-400 font-medium max-w-[250px] mx-auto">Agendá tus viajes compartidos con 12hs de anticipación y optimizá tus ganancias.</p>
                                    <Button className="h-14 px-10 rounded-2xl bg-primary text-white font-black uppercase text-[10px]">PROGRAMAR VIAJE</Button>
                                </TabsContent>
                            </>
                        ) : (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* PREVENTISTA DASHBOARD */}
                                <div className="grid grid-cols-2 gap-4">
                                    <Card className="rounded-[2.5rem] bg-red-50 border-none p-6 text-center">
                                        <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Comisiones</p>
                                        <h4 className="text-2xl font-black text-primary">$125.400</h4>
                                    </Card>
                                    <Card className="rounded-[2.5rem] bg-red-50 border-none p-6 text-center">
                                        <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Negocios</p>
                                        <h4 className="text-2xl font-black text-primary">12</h4>
                                    </Card>
                                </div>

                                <Card className="rounded-[3rem] bg-primary text-white p-10 shadow-2xl relative overflow-hidden">
                                    <div className="relative z-10">
                                        <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">Expande la Red</h3>
                                        <p className="text-[10px] font-bold text-white/60 mb-8">Gana $50.000 por cada comercio que actives</p>
                                        
                                        <div className="space-y-4">
                                            <Button onClick={() => {
                                                navigator.clipboard.writeText(`https://www.redeconomix.com/registro?ref=${user?.uid}`);
                                                toast({ title: "LINK COPIADO", description: "Ya puedes compartirlo en tus redes." });
                                            }} className="w-full h-16 max-sm:h-12 bg-white text-primary rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3">
                                                <Share2 className="h-5 w-5" /> COPIAR LINK DE REFERIDO
                                            </Button>
                                            
                                            <Button className="w-full h-16 max-sm:h-12 bg-primary hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 border-none">
                                                <QrCode className="h-5 w-5" /> MOSTRAR MI Código QR
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                                </Card>

                                <div className="space-y-4">
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Herramientas de Venta</h5>
                                    
                                    <div className="relative group px-4">
                                        <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="BUSCAR PRODUCTO PARA COMPARTIR..." 
                                            className="w-full h-14 bg-slate-50 border-none rounded-2xl pl-12 pr-6 font-bold text-[11px] uppercase tracking-wider focus:ring-2 focus:ring-primary outline-none shadow-inner"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {(catalogProducts || []).filter((p: any) => p.name?.toLowerCase().includes(searchQuery.toLowerCase())).map((item: any) => (
                                            <Card key={item.id} className="rounded-2xl border border-slate-100 p-4 flex items-center justify-between hover:border-primary/20 transition-colors shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center font-bold text-slate-400 text-[8px] text-center p-1 shrink-0 overflow-hidden">
                                                        {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : "PROD"}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xs font-black uppercase tracking-tight">{item.name || 'Producto'}</h4>
                                                        <p className="text-[10px] font-bold text-slate-900">${(item.price || 0).toLocaleString('es-AR')}</p>
                                                        <p className="text-[9px] font-black text-primary uppercase tracking-widest mt-0.5">Ganas ${(item.commission || (item.price * 0.1)).toLocaleString('es-AR')}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button onClick={() => {
                                                        navigator.clipboard.writeText(`https://www.redeconomix.com/producto/${item.id}?ref=${user?.uid}`);
                                                        toast({ title: "LINK GENERADO", description: "Enlace de afiliado copiado al portapapeles." });
                                                    }} size="icon" className="w-12 h-12 bg-primary text-white rounded-xl shadow-lg">
                                                        <Share2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="icon" variant="outline" className="w-12 h-12 rounded-xl border-slate-200">
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </Tabs>
                </>
            )}

            {activeJob && (
                <div className="fixed inset-0 z-[5000] bg-white flex flex-col font-sans overflow-hidden">
                    <div className="relative flex-1">
                        <TravelMap 
                                currentCoords={coords} 
                                stops={activeJob.stops} 
                                currentStopIndex={activeJob.currentStopIndex} 
                                setRoutePoints={setCurrentRoutePoints}
                                currentRoutePoints={currentRoutePoints}
                                setIsRouteLoading={setIsRouteLoading}
                                vehicleType={activeJob.vehicle}
                                isTestDriving={isTestDriving}
                            />
                        
                        <div className="absolute top-8 left-6 z-[6000] flex flex-col gap-4">
                            <Button variant="secondary" className="w-14 h-14 rounded-full bg-white shadow-2xl flex items-center justify-center p-0 border-none" onClick={() => setActiveJob(null)}><X className="h-7 w-7 text-slate-900" /></Button>
                        </div>

                        <div className="absolute bottom-72 right-6 z-[6000] flex flex-col gap-4">
                            <Button className="w-14 h-14 rounded-full bg-white shadow-2xl border-none p-0 flex items-center justify-center text-slate-900"><Radio className="h-6 w-6" /></Button>
                            <Button className="w-14 h-14 rounded-full bg-white shadow-2xl border-none p-0 flex items-center justify-center text-rose-500"><Shield className="h-6 w-6" /></Button>
                        </div>

                        <div className="absolute top-8 right-6 z-[6000] flex flex-col items-end gap-3">
                            <Button 
                                disabled={isRouteLoading}
                                onClick={() => { setIsTestDriving(!isTestDriving); }} 
                                className={cn("h-12 rounded-full px-6 font-black uppercase text-[9px] shadow-2xl border-none transition-all", "bg-primary", "text-white")}
                            >
                                {isRouteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isTestDriving ? "DETENER SIMULACIÓN" : "INICIAR RUTA")}
                            </Button>
                        </div>
                    </div>

                    <div className="relative z-[6001] px-4 pb-4">
                        <Card className="rounded-[2.5rem] bg-white shadow-[0_-20px_50px_rgba(0,0,0,0.1)] border-none p-8 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl", "bg-slate-50")}>{activeJob.icon}</div>
                                    <div>
                                        <h4 className="text-lg font-black uppercase tracking-tighter text-slate-900 leading-none">{activeJob.name}</h4>
                                        <div className="flex items-center gap-2 mt-2">
                                            <Timer className="h-3 w-3 text-primary" />
                                            <p className="text-[9px] font-black text-primary uppercase tracking-widest">{activeJob.stops[activeJob.currentStopIndex].name}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-black text-slate-900">${activeJob.fee}</p>
                                </div>
                            </div>
                            
                            <div className="flex">
                                <Button className={cn("w-full h-18 rounded-2xl text-white font-black uppercase text-[10px] tracking-widest shadow-xl", "bg-slate-900")} onClick={() => {
                                    if (activeJob.currentStopIndex < activeJob.stops.length - 1) {
                                        setActiveJob({ ...activeJob, currentStopIndex: activeJob.currentStopIndex + 1 });
                                        setRouteStepIndex(0);
                                        setIsRouteLoading(true);
                                    } else {
                                        setPaymentStep('selection');
                                        setShowPaymentModal(true);
                                    }
                                }}>
                                    {(() => {
                                        const isLast = activeJob.currentStopIndex === activeJob.stops.length - 1;
                                        
                                        if (activeJob.type === 'DELIVERY') return isLast ? 'ENTREGAR PEDIDO' : 'RECOGER PEDIDO';
                                        return isLast ? 'FINALIZAR VIAJE' : 'RECOGER PASAJERO';
                                    })()}
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
                <DialogContent className="rounded-[3rem] p-10 max-w-md border-none shadow-2xl z-[9999] bg-white">
                    {paymentStep === 'selection' && (
                        <div className="space-y-6">
                            <DialogHeader className="text-center">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">CIERRE DE RUTA</DialogTitle>
                            </DialogHeader>
                            <div className="text-center py-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                                    COBRO TOTAL SERVICIO
                                </p>
                                <h2 className="text-5xl font-black text-slate-900 tracking-tighter">${activeJob?.fee}</h2>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <Button onClick={() => setPaymentStep('rating')} className="h-16 max-sm:h-12 rounded-[1.2rem] bg-red-50 text-primary border-none flex items-center justify-between px-6"><div className="flex items-center gap-4"><Banknote className="h-5 w-5" /><p className="text-[10px] font-black uppercase">EFECTIVO</p></div><ChevronRight className="h-4 w-4 opacity-30" /></Button>
                                <Button onClick={() => setPaymentStep('qr')} className="h-16 max-sm:h-12 rounded-[1.2rem] bg-red-50 text-primary border-none flex items-center justify-between px-6"><div className="flex items-center gap-4"><QrCode className="h-5 w-5" /><p className="text-[10px] font-black uppercase">ESCANEAR QR</p></div><ChevronRight className="h-4 w-4 opacity-30" /></Button>
                                <Button onClick={() => setPaymentStep('transfer')} className="h-16 max-sm:h-12 rounded-[1.2rem] bg-slate-800 text-white border-none flex items-center justify-between px-6"><div className="flex items-center gap-4"><Share2 className="h-5 w-5 text-white/60" /><p className="text-[10px] font-black uppercase">TRANSFERENCIA / ALIAS</p></div><ChevronRight className="h-4 w-4 opacity-30" /></Button>
                            </div>
                        </div>
                    )}
                    {(paymentStep === 'qr' || paymentStep === 'rating') && (
                        <div className="space-y-8 py-4">
                            {paymentStep === 'qr' && (
                                <div className="flex flex-col items-center gap-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                    <QrCode className="h-32 w-32 text-slate-900" />
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">VALIDANDO PAGOS CARPOOL...</p>
                                </div>
                            )}
                            <div className="text-center"><h3 className="text-xl font-black uppercase text-slate-900">CALIFICAR GRUPO</h3></div>
                            <div className="flex justify-center gap-3">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button key={star} onClick={() => setRating(star)} className="focus:outline-none"><Star className={cn("h-10 w-10", star <= rating ? "fill-primary text-primary" : "text-slate-200")} /></button>
                                ))}
                            </div>
                            <Button onClick={() => {
                                toast({ title: "RUTA CARPOOL FINALIZADA", description: "Todos los pasajeros calificados.", className: "bg-primary text-white rounded-3xl" });
                                setShowPaymentModal(false); setActiveJob(null); setRating(0); setIsTestDriving(false); setCurrentRoutePoints([]); setActiveTab("radar");
                            }} disabled={rating === 0} className="w-full h-16 max-sm:h-12 rounded-[1.5rem] bg-slate-900 text-white font-black uppercase text-xs tracking-widest shadow-xl">FINALIZAR MISION</Button>
                        </div>
                    )}
                    {paymentStep === 'transfer' && (
                        <div className="space-y-8">
                            <div className="text-center bg-slate-50 p-8 rounded-[2rem] border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ALIAS CARPOOL</p><h3 className="text-lg font-black text-slate-900 uppercase">{activeJob?.alias}</h3></div>
                            <Button onClick={() => setPaymentStep('rating')} className="w-full h-16 max-sm:h-12 rounded-xl bg-slate-900 text-white font-black uppercase text-xs shadow-xl">CONFIRMAR RECEPCIÓN TOTAL</Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* SAFETY DIALOG */}
            <Dialog open={showSafetyDialog} onOpenChange={setShowSafetyDialog}>
                <DialogContent className="rounded-[3rem] p-10 max-w-md border-none shadow-2xl bg-white">
                    <DialogHeader className="space-y-6 text-center">
                        <div className="mx-auto w-20 h-20 max-sm:h-14 rounded-full bg-rose-50 flex items-center justify-center">
                            <ShieldAlert className="w-10 h-10 text-rose-500" />
                        </div>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight text-slate-900">Protocolo de Seguridad</DialogTitle>
                        <DialogDescription className="text-[13px] font-medium leading-relaxed text-slate-500 text-center">
                            Por su seguridad y la de todos, contamos con sus datos personales. Ante cualquier tipo de falta grave o acoso, nos comunicaremos con el <span className="font-black text-rose-600">911</span> y brindaremos no solo asistencia a la víctima, sino también asesoramiento legal y gratuito con la finalidad de garantizar su bienestar.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="pt-6 space-y-3">
                        <Button onClick={acceptSafetyTermsProvider} className="w-full h-18 rounded-[1.8rem] bg-primary text-white font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">
                            Confirmar y Empezar
                        </Button>
                        <Button onClick={() => setShowSafetyDialog(false)} variant="ghost" className="w-full h-12 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-red-500 transition-colors">
                            Cancelar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
