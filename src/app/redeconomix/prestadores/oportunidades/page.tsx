'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, query, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, MapPin, Clock, DollarSign, Zap, Star, Navigation, Filter, CheckCircle, ChevronRight, Loader2, Sparkles, Phone, MessageSquare, Plus, Bike, Hammer, Truck, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { createNotification } from '@/lib/notifications';
import { useRouter } from 'next/navigation';
import { useAlerts } from '@/hooks/use-alerts';
import { useActivityTracking } from '@/hooks/use-activity';
import { ShoppingCart } from 'lucide-react';

export default function OportunidadesPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { playAlert } = useAlerts();
    const router = useRouter();
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'servicios' | 'logistica'>('all');

    // ── Activity tracking is now handled globally in layout-content.tsx ──

    const userDocRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userData, isLoading: isLoadingUserData } = useDoc(userDocRef);

    // 1. Query for Service Requests (B2C/B2B Services)
    const servicesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, "serviceRequests"), 
            where("status", "in", ["sent", "pending", "searching"])
        );
    }, [firestore]);
    const { data: serviceRequests, isLoading: isLoadingServices } = useCollection(servicesQuery);

    // 2. Query for Delivery Routes
    const routesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, "deliveryRoutes"),
            where("status", "==", "pending")
        );
    }, [firestore]);
    const { data: routes, isLoading: isLoadingRoutes } = useCollection(routesQuery);
    
    // 3. Query for Wholesale Orders awaiting provider (Purchase & Delivery)
    const wholesaleOrdersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, "orders_wholesaler"),
            where("status", "==", "awaiting_provider")
        );
    }, [firestore]);
    const { data: wholesaleOrders, isLoading: isLoadingWholesale } = useCollection(wholesaleOrdersQuery);

    // Merge and Sort
    const unifiedOpportunities = useMemo(() => {
        const merged: any[] = [];
        
        if (serviceRequests && (filterType === 'all' || filterType === 'servicios')) {
            serviceRequests.forEach(s => merged.push({ ...s, type: 'servicio' }));
        }
        if (routes && (filterType === 'all' || filterType === 'logistica')) {
            routes.forEach(r => merged.push({ ...r, type: 'ruta' }));
        }
        if (wholesaleOrders && (filterType === 'all' || filterType === 'logistica')) {
            wholesaleOrders.forEach(o => merged.push({ ...o, type: 'compra' }));
        }

        return merged.sort((a, b) => {
            const dateA = (a.createdAt?.toDate?.() || new Date(0)).getTime();
            const dateB = (b.createdAt?.toDate?.() || new Date(0)).getTime();
            return dateB - dateA; // Newest first
        });
    }, [serviceRequests, routes, wholesaleOrders, filterType]);

    // 🚨 SIREN LOGIC: Play when count increases
    const prevCount = useRef(0);
    useEffect(() => {
        if (unifiedOpportunities.length > prevCount.current) {
            playAlert('siren');
            toast({
                title: "¡NUEVA OPORTUNIDAD!",
                description: "Una nueva solicitud ha ingresado al radar.",
                variant: "default",
                className: "bg-primary text-white border-none font-black shadow-2xl"
            });
        }
        prevCount.current = unifiedOpportunities.length;
    }, [unifiedOpportunities.length, playAlert, toast]);

    const handleAcceptJob = async (id: string, type: 'servicio' | 'ruta' | 'compra', extraData?: any) => {
        if (!firestore || !user) return;
        setProcessingId(id);
        playAlert('ping'); // Audio feedback for clicking
        
        const providerName = userData?.fullName || [userData?.firstName, userData?.lastName].filter(Boolean).join(' ') || user.displayName || 'Prestador';
        const providerPhone = userData?.phone || user.phoneNumber || '';

        try {
            if (type === 'servicio') {
                await updateDoc(doc(firestore, "serviceRequests", id), {
                    providerId: user.uid,
                    providerName,
                    providerPhone,
                    providerVehicle: userData?.vehicleModel || '',
                    providerPlate: userData?.vehiclePlate || '',
                    status: 'confirmed',
                    updatedAt: serverTimestamp(),
                });
                if (extraData?.clientId) {
                    await createNotification(
                        extraData.clientId,
                        '¡Prestador Asignado!',
                        `${providerName} ha aceptado tu pedido.`,
                        'order_update'
                    );
                }
            } else if (type === 'compra') {
                await updateDoc(doc(firestore, "orders_wholesaler", id), {
                    carrierId: user.uid,
                    providerId: user.uid,
                    providerName,
                    providerPhone,
                    status: 'shipping',
                    acceptedAt: serverTimestamp()
                });
                toast({ title: "¡Compra Aceptada!", description: "Has tomado este pedido para compra y entrega." });
            } else {
                await updateDoc(doc(firestore, "deliveryRoutes", id), {
                    carrierId: user.uid,
                    providerId: user.uid,
                    providerName,
                    providerPhone,
                    status: 'assigned',
                    updatedAt: serverTimestamp(),
                });
                toast({ title: "¡Ruta Asignada!", description: "Has tomado el control de esta ruta logística." });
            }
            
            toast({ title: "¡Éxito!", description: "Trabajo aceptado correctamente." });
            router.push('/redeconomix/prestadores/servicios-activos');
        } catch (error) {
            console.error("Error accepting job:", error);
            toast({ title: "Error", description: "No se pudo procesar la solicitud.", variant: "destructive" });
        } finally {
            setProcessingId(null);
        }
    };

    const isLoading = isUserLoading || isLoadingUserData || isLoadingServices || isLoadingRoutes;

    if (isLoading) {
        return (
            <div className="flex flex-col justify-center items-center h-[80vh] bg-white gap-6">
                <div className="w-16 h-16 max-sm:h-12 border-4 border-slate-100 border-t-primary rounded-full animate-spin" />
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 animate-pulse">Sincronizando Radar...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8F9FC] pb-24">
            {/* Header Radar UI */}
            <div className="bg-white border-b border-slate-100 px-6 py-10 space-y-8">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h1 className="text-4xl font-bold uppercase tracking-tighter text-slate-900 leading-none">Radar de <span className="text-primary">Oportunidades</span></h1>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest leading-relaxed">Trabajos reales en <span className="text-slate-900">{userData?.city || 'tu zona'}</span></p>
                    </div>
                    <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-primary relative">
                        <Bell className="h-6 w-6" />
                        <div className="absolute top-3 right-3 h-2.5 w-2.5 bg-primary rounded-full border-2 border-white animate-ping" />
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-2 px-2 pb-1">
                    {[
                        { id: 'all', label: 'Todo', icon: Zap },
                        { id: 'servicios', label: 'Servicios', icon: Hammer },
                        { id: 'logistica', label: 'Logística', icon: Truck },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setFilterType(tab.id as any)}
                            className={cn(
                                "flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all shrink-0 font-bold uppercase text-[10px] tracking-widest",
                                filterType === tab.id ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/10" : "bg-white border-slate-100 text-slate-500"
                            )}>
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <main className="container max-w-4xl mx-auto p-6 space-y-8">
                <AnimatePresence mode="popLayout">
                    {unifiedOpportunities.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {unifiedOpportunities.map((job, idx) => (
                                <motion.div key={job.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                                    <Card className="group rounded-[2.5rem] bg-white border border-slate-100 overflow-hidden flex flex-col transition-all hover:border-primary/20 hover:shadow-2xl hover:shadow-red-500/5">
                                        <CardHeader className="p-8 border-b border-slate-50 flex flex-row items-center justify-between bg-slate-50/30">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge className={cn(
                                                        "rounded-full text-[8px] font-bold uppercase px-3 py-0.5",
                                                        job.type === 'ruta' ? "bg-emerald-500 text-white" : job.type === 'compra' ? "bg-amber-500 text-white" : "bg-primary text-white"
                                                    )}>
                                                        {job.type === 'ruta' ? 'Logística B2B' : job.type === 'compra' ? 'Compra y Entrega' : 'Servicio Directo'}
                                                    </Badge>
                                                </div>
                                                <CardTitle className="text-lg font-bold uppercase tracking-tight text-slate-900 leading-tight">
                                                    {job.type === 'ruta' ? `Ruta: ${job.wholesalerName}` : job.type === 'compra' ? `Pedido #${job.id.slice(-6).toUpperCase()}` : job.serviceType}
                                                </CardTitle>
                                                <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-[9px] tracking-widest">
                                                    <MapPin className="h-3 w-3" />
                                                    {job.address?.split(',')[0] || job.origin || 'Dirección no especificada'}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-white rounded-2xl border border-slate-100 transition-transform group-hover:scale-110">
                                                {job.serviceType?.toLowerCase().includes('moto') ? <Bike className="h-6 w-6 text-primary" /> : job.type === 'ruta' ? <Truck className="h-6 w-6 text-emerald-500" /> : job.type === 'compra' ? <ShoppingCart className="h-6 w-6 text-amber-500" /> : <Hammer className="h-6 w-6 text-primary" />}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-8 space-y-6 flex-grow">
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Compensación</span>
                                                <span className="text-xl font-bold text-slate-900">${(job.totalPrice || job.agreedPrice || job.paymentAmount || job.totalAmount || 0).toLocaleString()}</span>
                                            </div>
                                            {job.type === 'ruta' ? (
                                                <div className="flex gap-4">
                                                     <div className="flex-1 p-3 bg-white rounded-xl border border-slate-100 text-center">
                                                         <p className="text-[8px] font-bold uppercase text-slate-300">Paradas</p>
                                                         <p className="text-sm font-bold">{job.totalStops}</p>
                                                     </div>
                                                     <div className="flex-1 p-3 bg-white rounded-xl border border-slate-100 text-center">
                                                         <p className="text-[8px] font-bold uppercase text-slate-300">Zona</p>
                                                         <p className="text-sm font-bold">{job.zone || 'Local'}</p>
                                                     </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs font-bold text-slate-500 leading-relaxed italic">
                                                    "{job.description || 'Sin descripción adicional'}"
                                                </p>
                                            )}
                                        </CardContent>
                                        <CardFooter className="p-8 bg-slate-50 border-t border-slate-100">
                                            <Button onClick={() => handleAcceptJob(job.id, job.type, job)} disabled={!!processingId} className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold uppercase tracking-tight text-sm shadow-xl transition-all active:scale-95">
                                                {processingId === job.id ? <Loader2 className="h-5 w-5 animate-spin" /> : "Aceptar Oportunidad"}
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-32 bg-white rounded-[3rem] border border-dashed border-slate-100 space-y-6 shadow-sm">
                            <div className="mx-auto w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center relative overflow-hidden">
                                <Search className="h-10 w-10 text-slate-100" />
                                <div className="absolute inset-0 border-2 border-primary/10 rounded-full animate-ping" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-slate-900 font-bold uppercase tracking-tighter text-xl leading-none">Radar en Escucha...</p>
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] px-12 leading-relaxed">No hay trabajos disponibles en <span className="text-primary">{userData?.city || 'tu zona'}</span> justo ahora. Te avisaremos apenas aparezca algo.</p>
                            </div>
                        </div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
