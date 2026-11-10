'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, query, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { Preferences } from '@capacitor/preferences';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, MapPin, Calendar, Clock, ChevronRight, Loader2, Zap, X, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { createNotification } from '@/lib/notifications';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';


export default function SolicitudesPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [localOnline, setLocalOnline] = useState(false);

    useEffect(() => {
        const loadOnlineStatus = async () => {
            try {
                const { value } = await Preferences.get({ key: 'rex_provider_online_status' });
                setLocalOnline(value === 'true');
            } catch (e) {
                console.error("Preferences load error", e);
            }
        };
        loadOnlineStatus();
    }, []);
    
    const userDocRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userData, isLoading: isLoadingUserData } = useDoc(userDocRef);

    const servicesOffered = useMemo(() => {
        const raw = userData?.services?.length ? userData.services : userData?.categories;
        if (Array.isArray(raw) && raw.length > 0) {
            return raw;
        }
        return [];
    }, [userData]);

    const availableRequestsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, "serviceRequests"), 
            where("status", "in", ["sent", "pending", "searching"])
        );
    }, [firestore]);

    const { data: rawRequests, isLoading: isLoadingRequests } = useCollection(availableRequestsQuery);

    const requests = useMemo(() => {
        if (!rawRequests) return [];
        const cityFiltered = userData?.cityId
            ? rawRequests.filter((r: any) => !r.cityId || r.cityId === userData.cityId)
            : rawRequests;
        const baseList = cityFiltered.length > 0 ? cityFiltered : rawRequests;
        if (!servicesOffered || servicesOffered.length === 0) {
            return baseList;
        }
        const matched = baseList.filter((r: any) => {
            const st = (r.serviceType || '').toLowerCase();
            return servicesOffered.some((offered: string) => {
                const o = (offered || '').toLowerCase();
                return st.includes(o) || o.includes(st);
            });
        });
        return matched.length > 0 ? matched : baseList;
    }, [rawRequests, userData?.cityId, servicesOffered]);

    const handleAccept = async (requestId: string, clientName: string, clientId: string) => {
        if (!firestore || !user) return;
        setProcessingId(requestId);
        try {
            await updateDoc(doc(firestore, "serviceRequests", requestId), {
                providerId: user.uid,
                providerName: userData?.fullName || [userData?.firstName, userData?.lastName].filter(Boolean).join(' ') || user.displayName || 'Prestador',
                providerPhone: userData?.phone || user.phoneNumber || '',
                providerVehicle: userData?.vehicleModel || '',
                providerPlate: userData?.vehiclePlate || '',
                status: 'confirmed',
                updatedAt: serverTimestamp(),
            });
            if (clientId) {
                await createNotification(
                    clientId,
                    '¡Prestador Confirmado!',
                    `${userData?.fullName || user.displayName || 'Un prestador'} ha aceptado tu solicitud y pronto se pondrá en camino.`,
                    'order_update'
                );
            }
            toast({ title: "¡Trabajo Aceptado!", description: `Te asignaste la solicitud de ${clientName}.` });
        } catch (error) {
            console.error("Error accepting job:", error);
            toast({ title: "Error", description: "No se pudo aceptar el trabajo.", variant: "destructive" });
        } finally {
            setProcessingId(null);
        }
    };

    const isLoading = isUserLoading || isLoadingUserData || isLoadingRequests;
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-screen bg-white"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }
    
    const isAvailable = userData?.availability === 'available' || localOnline;

    if (!isAvailable) {
        return (
             <div className="container max-w-2xl mx-auto py-12 px-4">
                <Card className="rounded-[3rem] bg-white border border-slate-100 p-10 text-center space-y-8 shadow-xl">
                    <div className="mx-auto w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center border border-slate-100">
                        <X className="h-12 w-12 text-slate-200" />
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-3xl font-bold  uppercase tracking-tight text-slate-900 leading-tight">Estás Fuera <br/><span className="text-primary">de Servicio</span></h2>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest leading-relaxed">Necesitás estar disponible para recibir trabajos</p>
                    </div>
                    
                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-between gap-4">
                         <Badge className="bg-slate-200 text-slate-400 border-none font-bold  uppercase text-[10px] px-4">Offline</Badge>
                         <Switch checked={false} disabled className="data-[state=unchecked]:bg-slate-200" />
                    </div>

                    <Button asChild className="rounded-2xl h-14 w-full font-bold  uppercase tracking-tight text-lg bg-primary text-white shadow-lg shadow-red-500/20 hover:scale-[1.02] transition-all">
                        <Link href="/redeconomix/prestadores/panel">Ir al Panel de Control</Link>
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="container max-w-4xl mx-auto py-12 px-4 space-y-12">
            <div className="space-y-2">
                <h1 className="text-4xl font-bold  uppercase tracking-tight text-slate-900 leading-none">Solicitudes <span className="text-primary ">Disponibles</span></h1>
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest leading-relaxed">Trabajos disponibles en tu zona de cobertura</p>
            </div>
            {requests && requests.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {requests.map(req => (
                        <Card key={req.id} className="group rounded-[2.5rem] bg-white border border-slate-100 overflow-hidden flex flex-col transition-all hover:border-primary/20 hover:shadow-xl hover:shadow-red-500/5">
                            <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100 flex-row items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <CardTitle className="text-xl font-bold  uppercase tracking-tight text-slate-900 leading-tight">{req.serviceType}</CardTitle>
                                    <div className="flex items-center gap-1.5 text-primary font-bold  uppercase text-[10px] tracking-widest">
                                        <MapPin className="h-3 w-3" />
                                        {req.address}
                                    </div>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border border-slate-100 group-hover:scale-110 transition-transform">
                                    <Zap className="h-6 w-6 text-primary" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 flex-grow space-y-6">
                                <p className="text-sm font-bold text-slate-500 leading-relaxed">{req.description || req.notes || 'Sin descripción adicional'}</p>
                                <div className="pt-4 border-t border-slate-50">
                                    <p className="text-[10px] font-bold  uppercase tracking-widest text-slate-300">
                                        SOLICITADO: {req.createdAt?.toDate ? new Date(req.createdAt.toDate()).toLocaleString('es-AR') : 'Reciente'}
                                    </p>
                                </div>
                            </CardContent>
                            <CardFooter className="p-8 bg-slate-50 flex gap-4 border-t border-slate-100">
                                <Button 
                                    className="flex-1 h-14 rounded-2xl bg-primary text-white font-bold  uppercase tracking-tight shadow-lg shadow-red-500/20 hover:scale-[1.02] transition-all" 
                                    onClick={() => handleAccept(req.id, req.clientName || 'un cliente', req.clientId)} 
                                    disabled={!!processingId}
                                >
                                    {processingId === req.id ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Check className="mr-2 h-5 w-5" />}
                                    Aceptar Trabajo
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="h-14 px-5 rounded-2xl border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-colors" 
                                    disabled={!!processingId}
                                >
                                    <X className="h-6 w-6"/>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-32 bg-white rounded-[3rem] border border-dashed border-slate-100 space-y-6 shadow-sm">
                    <div className="mx-auto w-20 h-20 max-sm:h-14 bg-slate-50 rounded-[2rem] flex items-center justify-center">
                         <Zap className="h-10 w-10 text-slate-100" />
                    </div>
                    <p className="text-slate-400 font-bold  uppercase tracking-widest leading-relaxed">No hay solicitudes <br/><span className="text-primary">en este momento</span></p>
                </div>
            )}
        </div>
    );
}
