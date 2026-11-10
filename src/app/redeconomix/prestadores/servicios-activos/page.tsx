'use client';

import { useState, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { Geolocation } from '@capacitor/geolocation';
import { collection, doc, query, updateDoc, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Truck, Check, LocateFixed, Hammer, CheckCircle, MessageSquare, Bike, MapPin, Package, Sparkles, Navigation, Info, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { createNotification } from '@/lib/notifications';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { PaymentHub } from '@/components/payment-hub';
import { Camera, X } from 'lucide-react';

const defaultStatusMap: { [key: string]: { label: string; nextStatus: string; buttonText: string, buttonIcon: React.ElementType } } = {
    'accepted': { label: 'Confirmado', nextStatus: 'on_the_way', buttonText: 'Voy en Camino', buttonIcon: Truck },
    'confirmed': { label: 'Confirmado', nextStatus: 'on_the_way', buttonText: 'Voy en Camino', buttonIcon: Truck },
    'on_the_way': { label: 'En Camino', nextStatus: 'arriving', buttonText: 'Estoy Llegando', buttonIcon: LocateFixed },
    'arriving': { label: 'En el lugar', nextStatus: 'in_progress', buttonText: 'Empezar Trabajo', buttonIcon: Hammer },
    'in_progress': { label: 'En Progreso', nextStatus: 'completed', buttonText: 'Finalizar Servicio', buttonIcon: CheckCircle },
};

const motoTaxiStatusMap: { [key: string]: { label: string; nextStatus: string; buttonText: string, buttonIcon: React.ElementType } } = {
    'accepted': { label: 'Confirmado', nextStatus: 'on_the_way', buttonText: 'EN CAMINO', buttonIcon: Bike },
    'confirmed': { label: 'Confirmado', nextStatus: 'on_the_way', buttonText: 'EN CAMINO', buttonIcon: Bike },
    'on_the_way': { label: 'En Camino', nextStatus: 'arriving', buttonText: 'LLEGUÉ AL PUNTO DE RETIRO', buttonIcon: LocateFixed },
    'arriving': { label: 'En el punto', nextStatus: 'in_progress', buttonText: 'INICIAR VIAJE', buttonIcon: Bike },
    'in_progress': { label: 'En Viaje', nextStatus: 'completed', buttonText: 'FINALIZAR VIAJE', buttonIcon: CheckCircle },
};


export default function ServiciosActivosPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [isPaymentTerminalOpen, setIsPaymentTerminalOpen] = useState(false);
    const [currentPaymentService, setCurrentPaymentService] = useState<any>(null);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

    const activeRequestsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, "serviceRequests"),
            where("providerId", "==", user.uid),
            where("status", "in", ["accepted", "confirmed", "on_the_way", "arriving", "in_progress"])
        );
    }, [firestore, user]);

    const { data: services, isLoading: isLoadingServices } = useCollection(activeRequestsQuery);
    
    const activeRoutesQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, "deliveryRoutes"),
            where("carrierId", "==", user.uid),
            where("status", "in", ["accepted", "assigned", "in_progress"])
        );
    }, [firestore, user]);
    const { data: routes, isLoading: isLoadingRoutes } = useCollection(activeRoutesQuery);
    
    // 3. Query for Wholesale Orders (Purchase & Delivery) handled by this carrier
    const activeWholesaleQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, "orders_wholesaler"),
            where("carrierId", "==", user.uid),
            where("status", "in", ["shipping", "processing"])
        );
    }, [firestore, user]);
    const { data: wholesaleOrders, isLoading: isLoadingWholesale } = useCollection(activeWholesaleQuery);

    // Emits GPS for ANY active service that is on the move
    useEffect(() => {
        if (!firestore || !user) return;

        // Find any active service or wholesale order that needs tracking
        const activeService = services?.find((s: any) => (s.status === 'on_the_way' || s.status === 'in_progress'));
        const activeWholesale = wholesaleOrders?.find((o: any) => (o.status === 'shipping'));

        if (!activeService && !activeWholesale) return;

        let activeWatchId: string | null = null;

        const startTracking = async () => {
            try {
                activeWatchId = await Geolocation.watchPosition(
                    { enableHighAccuracy: true },
                    async (position, err) => {
                        if (position) {
                            const { latitude, longitude } = position.coords;
                            try {
                                // Update Service Request if active
                                if (activeService) {
                                    await updateDoc(doc(firestore!, "serviceRequests", activeService.id), {
                                        driverLat: latitude,
                                        driverLon: longitude
                                    });
                                }
                                // Update Wholesale Order if active
                                if (activeWholesale) {
                                    await updateDoc(doc(firestore!, "orders_wholesaler", activeWholesale.id), {
                                        driverLat: latitude,
                                        driverLon: longitude
                                    });
                                }
                            } catch (e) { console.error("GPS Emission Error:", e); }
                        }
                    }
                );
            } catch (err) {
                console.error("GPS Watch Error:", err);
            }
        };

        startTracking();

        return () => {
            if (activeWatchId !== null) {
                Geolocation.clearWatch({ id: activeWatchId });
            }
        };
    }, [firestore, user, services, wholesaleOrders]);

    const handleStatusUpdate = async (service: any) => {
        if (!firestore) return;
        
        const isMotoTaxi = (service.serviceType || '').toLowerCase().includes('moto taxi');
        const currentStatusMap = isMotoTaxi ? motoTaxiStatusMap : defaultStatusMap;
        const currentStatusInfo = currentStatusMap[service.status];

        if (!currentStatusInfo) return;

        setProcessingId(service.id);
        setIsProcessing(true);
        const nextStatus = currentStatusInfo.nextStatus;

        try {
            await updateDoc(doc(firestore, "serviceRequests", service.id), { status: nextStatus });
            
            const nextStatusInfo = currentStatusMap[nextStatus];
            let notificationMessage = `${user?.displayName || 'Un prestador'} ha actualizado el estado de tu pedido a: ${nextStatusInfo?.label || nextStatus}.`;
            if (nextStatus === 'on_the_way') {
                notificationMessage = `${user?.displayName || 'Un prestador'} está en camino.`;
            } else if (nextStatus === 'arriving') {
                notificationMessage = `${user?.displayName || 'Un prestador'} ha llegado a tu ubicación.`;
            } else if (nextStatus === 'completed') {
                notificationMessage = 'Tu servicio ha sido finalizado. ¡No olvides calificarlo!';
            }
            
            await createNotification(
                service.clientId,
                'Actualización de tu servicio',
                notificationMessage,
                'order_update'
            );

            toast({ title: "Estado Actualizado", description: `El servicio ahora está: ${currentStatusMap[nextStatus]?.label || nextStatus}` });
            
            if (nextStatus === 'completed') {
                if (service.paymentMethod && service.paymentMethod !== 'tarjeta') {
                    setCurrentPaymentService(service);
                    setIsPaymentTerminalOpen(true);
                } else {
                    setShowSuccessModal(true);
                }
            }
        } catch (error) {
            console.error("Error updating status:", error);
            toast({ title: "Error", description: "No se pudo actualizar el estado del servicio.", variant: "destructive" });
        } finally {
            setProcessingId(null);
            setIsProcessing(false);
        }
    };
    
    const handleGoToChat = (serviceId: string) => {
        router.push(`/redeconomix/prestadores/chat/${serviceId}`);
    };

    if (isUserLoading || isLoadingServices || isLoadingRoutes) {
        return <div className="flex justify-center items-center h-screen bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }

    return (
        <div className="container max-w-4xl mx-auto py-12 px-4 space-y-12">
            <div className="space-y-2">
                <h1 className="text-4xl font-bold  uppercase tracking-tight text-slate-900 leading-none">Trabajos <span className="text-primary ">Activos</span></h1>
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest leading-relaxed">Gestioná tus tareas en curso y actualizá estados</p>
            </div>

            <div className="space-y-12">
                {/* Active Service Requests */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold  uppercase tracking-tight text-slate-900 px-1">Servicios Generales</h2>
                    {services && services.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {services.map(service => {
                                const isMotoTaxi = (service.serviceType || '').toLowerCase().includes('moto taxi');
                                const currentStatusMap = isMotoTaxi ? motoTaxiStatusMap : defaultStatusMap;
                                const statusInfo = currentStatusMap[service.status];
                                return (
                                    <Card key={service.id} className="group rounded-[2.5rem] bg-white border border-slate-100 overflow-hidden flex flex-col transition-all hover:border-primary/20 hover:shadow-xl hover:shadow-red-500/5">
                                        <CardHeader className="p-8 border-b border-slate-50 flex flex-row items-center justify-between bg-slate-50/30">
                                            <div className="space-y-1">
                                                <CardTitle className="text-xl font-bold  uppercase tracking-tight text-slate-900">{service.serviceType}</CardTitle>
                                                <div className="flex items-center gap-1.5 text-primary font-bold  uppercase text-[10px] tracking-widest">
                                                    <MapPin className="h-3 w-3" />
                                                    {(service.address || service.origin || 'Sin dirección').split(',')[0]}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-white rounded-2xl border border-slate-100 group-hover:scale-110 transition-transform">
                                                {isMotoTaxi ? <Bike className="h-6 w-6 text-primary" /> : <Hammer className="h-6 w-6 text-primary" />}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-8 space-y-4 flex-grow">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado Operativo</span>
                                                <Badge className="bg-primary text-white border-none rounded-full text-[10px] font-bold  uppercase px-4 py-1 animate-pulse">
                                                    {statusInfo?.label}
                                                </Badge>
                                            </div>
                                            <p className="text-sm font-bold text-slate-500 leading-relaxed ">
                                                {isMotoTaxi ? `Destino: ${service.destinationAddress || service.destination || ''}` : (service.description || service.notes || (service.destinationAddress || service.destination ? `Destino: ${service.destinationAddress || service.destination || ''}` : ''))}
                                            </p>
                                        </CardContent>
                                        <CardFooter className="p-8 bg-slate-50 flex flex-col gap-4 border-t border-slate-100">
                                            {statusInfo && (
                                                <Button 
                                                    className="w-full h-14 rounded-2xl bg-primary text-white font-bold  uppercase tracking-tight shadow-lg shadow-red-500/20 hover:scale-[1.02] transition-all" 
                                                    onClick={() => handleStatusUpdate(service)} 
                                                    disabled={!!processingId}
                                                >
                                                    {processingId === service.id ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <statusInfo.buttonIcon className="mr-2 h-5 w-5" />}
                                                    {statusInfo.buttonText}
                                                </Button>
                                            )}
                                            <Button 
                                                variant="outline" 
                                                className="w-full h-12 rounded-xl border-slate-200 text-slate-600 font-bold  uppercase text-[10px] tracking-widest hover:bg-white hover:border-primary/20 transition-all" 
                                                onClick={() => handleGoToChat(service.id)}
                                            >
                                                <MessageSquare className="mr-2 h-4 w-4 text-primary"/> Abrir Terminal Chat
                                            </Button>

                                            <Button 
                                                variant="outline" 
                                                className="w-full h-12 rounded-xl border-slate-900 text-slate-900 font-bold uppercase text-[10px] tracking-widest hover:bg-slate-900 hover:text-white transition-all" 
                                                asChild
                                            >
                                                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(service.address || service.origin || '')}`} target="_blank" rel="noopener noreferrer">
                                                    <Navigation className="mr-2 h-4 w-4"/> Navegar al Pedido (GPS)
                                                </a>
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-100 space-y-4">
                             <Hammer className="h-10 w-10 text-slate-100 mx-auto" />
                            <p className="text-slate-400 font-bold  uppercase tracking-widest text-xs">Sin trabajos generales <span className="text-primary ">activos</span></p>
                        </div>
                    )}
                </div>

                {/* Wholesale Purchase & Delivery Orders */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold  uppercase tracking-tight text-slate-900 px-1">Pedidos de Compra y Entrega</h2>
                    {wholesaleOrders && wholesaleOrders.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {wholesaleOrders.map(order => (
                                <Card key={order.id} className="group rounded-[2.5rem] bg-white border border-slate-100 overflow-hidden flex flex-col transition-all hover:border-primary/20 hover:shadow-xl hover:shadow-red-500/5">
                                    <CardHeader className="p-8 border-b border-slate-50 flex flex-row items-center justify-between bg-slate-50/30">
                                        <div className="space-y-1">
                                            <CardTitle className="text-xl font-bold  uppercase tracking-tight text-slate-900">Pedido #{order.id.slice(-6).toUpperCase()}</CardTitle>
                                            <div className="flex items-center gap-1.5 text-amber-600 font-bold  uppercase text-[10px] tracking-widest">
                                                <ShoppingCart className="h-3 w-3" />
                                                {order.wholesalerName}
                                            </div>
                                        </div>
                                        <div className="p-4 bg-white rounded-2xl border border-slate-100 group-hover:scale-110 transition-transform">
                                            <Package className="h-6 w-6 text-amber-500" />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-8 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado</span>
                                            <Badge className="bg-amber-500 text-white border-none rounded-full text-[10px] font-bold  uppercase px-4 py-1">
                                                {order.status === 'shipping' ? 'EN REPARTO' : 'PROCESANDO'}
                                            </Badge>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest mb-1">Dirección de Entrega</p>
                                            <p className="text-xs font-bold text-slate-700">{order.shippingAddress?.address || 'Ver en mapa'}</p>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                                        <Button className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold uppercase text-[10px] tracking-widest shadow-lg" asChild>
                                            <Link href={`/redeconomix/servicios/seguimiento/${order.id}`}>
                                                <Navigation className="mr-2 h-4 w-4" /> Ver Mi Ruta GPS
                                            </Link>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-100 space-y-4">
                             <Package className="h-10 w-10 text-slate-100 mx-auto" />
                            <p className="text-slate-400 font-bold  uppercase tracking-widest text-xs">Sin pedidos de compra <span className="text-primary ">pendientes</span></p>
                        </div>
                    )}
                </div>

                {/* Active Delivery Routes */}
                <div className="space-y-6">
                     <h2 className="text-xl font-bold  uppercase tracking-tight text-slate-900 px-1">Rutas de Reparto</h2>
                      {routes && routes.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {routes.map(route => (
                                <Card key={route.id} className="group rounded-[2.5rem] bg-white border border-slate-100 overflow-hidden flex flex-col transition-all hover:border-primary/20 hover:shadow-xl hover:shadow-red-500/5">
                                    <CardHeader className="p-8 border-b border-slate-50 flex flex-row items-center justify-between bg-slate-50/30">
                                        <div className="space-y-1">
                                            <CardTitle className="text-xl font-bold  uppercase tracking-tight text-slate-900">Logística VIP</CardTitle>
                                            <div className="flex items-center gap-1.5 text-primary font-bold  uppercase text-[10px] tracking-widest">
                                                <Truck className="h-3 w-3" />
                                                {route.wholesalerName}
                                            </div>
                                        </div>
                                        <div className="p-4 bg-white rounded-2xl border border-slate-100">
                                            <Package className="h-6 w-6 text-primary" />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-8 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest mb-1">Paradas</p>
                                                <p className="text-lg font-bold  text-slate-900">{route.totalStops}</p>
                                            </div>
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest mb-1">Estado</p>
                                                <p className="text-xs font-bold  text-primary uppercase">{route.status === 'assigned' ? 'Pendiente' : 'En Ruta'}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="p-8 bg-slate-50 border-t border-slate-100">
                                        <Button className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold  uppercase tracking-tight shadow-xl transition-all" asChild>
                                            <Link href={`/redeconomix/prestadores/rutas/${route.id}`}>
                                                <Truck className="mr-3 h-5 w-5" /> Iniciar / Gestionar Ruta
                                            </Link>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-100 space-y-4">
                             <Truck className="h-10 w-10 text-slate-100 mx-auto" />
                            <p className="text-slate-400 font-bold  uppercase tracking-widest text-xs">Sin rutas VIP <span className="text-primary ">asignadas</span></p>
                        </div>
                    )}
                </div>
            </div>

            {/* PAYMENT TERMINAL DIALOG */}
            <Dialog open={isPaymentTerminalOpen} onOpenChange={setIsPaymentTerminalOpen}>
                <DialogContent className="max-w-md rounded-[3rem] bg-[#020617] border-white/10 p-0 overflow-hidden shadow-3xl text-white">
                    <div className="bg-primary p-10 text-white relative">
                        <div className="absolute right-0 top-0 w-40 h-40 bg-white/20 rounded-full blur-3xl -mr-20 -mt-20" />
                        <DialogTitle className="text-3xl font-black uppercase tracking-tighter leading-none italic">Terminal Cohete</DialogTitle>
                        <DialogDescription className="text-[10px] text-white/60 uppercase font-black tracking-widest mt-2">
                            Cobro pendiente: {currentPaymentService?.paymentMethod}
                        </DialogDescription>
                    </div>
                    
                    <div className="p-8 max-h-[70vh] overflow-y-auto no-scrollbar">
                        {!capturedPhoto ? (
                            <div className="space-y-8">
                                <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Mostrá tu QR o cobrá el efectivo</p>
                                    <PaymentHub />
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 text-primary">
                                        <Info className="h-5 w-5" />
                                        <p className="text-[10px] font-black uppercase tracking-widest leading-tight">Es obligatorio capturar el comprobante</p>
                                    </div>
                                    <Button 
                                        onClick={() => setCapturedPhoto('simulated_photo')} 
                                        className="w-full h-16 max-sm:h-12 bg-primary text-black font-black uppercase tracking-widest text-xs rounded-2xl flex items-center justify-center gap-3"
                                    >
                                        <Camera className="h-5 w-5" /> Capturar Comprobante
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-fade-in text-center">
                                <div className="relative w-full aspect-[3/4] bg-white/5 rounded-[2rem] border-2 border-primary overflow-hidden flex items-center justify-center">
                                    <CheckCircle className="h-16 max-sm:h-12 w-16 text-primary opacity-20 absolute" />
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Foto del Comprobante Capturada</p>
                                    <button onClick={() => setCapturedPhoto(null)} className="absolute top-4 right-4 p-2 bg-black/50 rounded-full"><X className="h-4 w-4" /></button>
                                </div>
                                
                                <Button 
                                    onClick={() => {
                                        setIsPaymentTerminalOpen(false);
                                        setCapturedPhoto(null);
                                        setShowSuccessModal(true);
                                    }} 
                                    className="w-full h-16 max-sm:h-12 bg-primary text-black font-black uppercase tracking-widest text-xs rounded-2xl"
                                >
                                    Finalizar y Registrar Cobro
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* SUCCESS MODAL */}
            <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
                <DialogContent className="max-w-md rounded-[3rem] bg-white border-none p-10 overflow-hidden shadow-3xl text-center">
                    <div className="w-24 h-24 rounded-[2rem] bg-primary flex items-center justify-center mx-auto mb-8 shadow-xl shadow-red-200 animate-in zoom-in duration-500">
                        <CheckCircle className="h-12 w-12 text-white" />
                    </div>
                    <div className="space-y-3 mb-8">
                        <DialogTitle className="text-3xl font-bold  uppercase tracking-tight text-slate-900 leading-none">¡Operación Exitosa!</DialogTitle>
                        <p className="text-slate-500 font-bold px-4 leading-snug">El servicio ha sido finalizado correctamente y el cliente ha sido notificado.</p>
                    </div>
                    <Button onClick={() => setShowSuccessModal(false)} className="w-full h-16 max-sm:h-12 bg-slate-900 text-white rounded-2xl font-bold  text-xl uppercase tracking-tight shadow-xl transition-all active:scale-95">
                        Volver al Panel
                    </Button>
                </DialogContent>
            </Dialog>

            {/* PROCESSING OVERLAY */}
            <AnimatePresence>
                {isProcessing && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center"
                    >
                        <div className="w-24 h-24 relative mb-8">
                            <div className="absolute inset-0 border-8 border-slate-100 rounded-[2.5rem]" />
                            <div className="absolute inset-0 border-8 border-primary rounded-[2.5rem] border-t-transparent animate-spin" />
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-3xl font-bold  uppercase tracking-tight text-slate-900 leading-none">Cambiando Estado</h3>
                            <p className="text-[10px] font-bold  text-slate-400 uppercase tracking-[0.4em] animate-pulse">Generando Transacción...</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
