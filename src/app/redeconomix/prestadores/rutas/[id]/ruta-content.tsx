'use client';

import React, { useState, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import { useDoc, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, getDoc, runTransaction, increment, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { createNotification } from '@/lib/notifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Truck, Check, CheckCircle, Package, ArrowLeft, Info, MessageSquare, Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

type Stop = {
    orderId: string;
    retailerName: string;
    address: string;
    status: 'pending' | 'delivered' | 'failed';
};

export default function RutaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const routeId = id;
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const routeDocRef = useMemoFirebase(() => {
        if (!firestore || !routeId) return null;
        return doc(firestore, 'deliveryRoutes', routeId);
    }, [firestore, routeId]);

    const { data: route, isLoading } = useDoc(routeDocRef);
    
    const handlePickupConfirmation = async () => {
        if (!firestore || !route || !routeDocRef || route.status !== 'assigned') return;
        setProcessingId('pickup');
        try {
            await runTransaction(firestore, async (transaction) => {
                // 1. Update the status of the main route document
                transaction.update(routeDocRef, { status: 'in_progress', pickupAt: serverTimestamp() });
    
                // 2. Update status of all associated orders to 'shipping'
                for (const stop of route.stops) {
                    const orderRef = doc(firestore, 'orders_wholesaler', stop.orderId);
                    transaction.update(orderRef, { status: 'shipping' });
                }
            });
    
            // 3. Send notifications to all clients on the route
            for (const stop of route.stops) {
                if (stop.clientId) {
                    await createNotification(stop.clientId, '¡Tu pedido está en camino!', `Tu pedido de ${route.wholesalerName || 'nuestra tienda'} ha sido despachado.`, 'order_update');
                }
            }
    
            toast({ title: "¡Carga Retirada!", description: "La ruta ha comenzado. ¡Buen viaje!" });
        } catch (error) {
            console.error("Error confirming pickup:", error);
            toast({ title: "Error", description: "No se pudo confirmar el retiro de la carga.", variant: "destructive" });
        } finally {
            setProcessingId(null);
        }
    };
    
    const handleDeliveryConfirmation = async (stopIndex: number) => {
        if (!firestore || !route || !user || !routeDocRef) return;
        const stop = route.stops[stopIndex];
        if (stop.status !== 'pending') return;
    
        setProcessingId(stop.orderId);
    
        try {
            // Create a new array of stops with the updated status
            const newStops = [...route.stops];
            newStops[stopIndex] = { ...stop, status: 'delivered', deliveredAt: serverTimestamp() };
    
            const allDelivered = newStops.every(s => s.status === 'delivered');
            const routeUpdateData: any = { stops: newStops };
    
            if (allDelivered) {
                routeUpdateData.status = 'completed';
                routeUpdateData.completedAt = serverTimestamp();
            }
    
            // Update the main route document first
            await updateDoc(routeDocRef, routeUpdateData);
    
            // Fetch order to check if it's a cash payment (COD)
            const orderRef = doc(firestore, 'orders_wholesaler', stop.orderId);
            const orderSnap = await getDoc(orderRef);
            
            if (orderSnap.exists()) {
                const orderData = orderSnap.data();
                
                // Si el pago es en efectivo (COD), el repartidor cobró físico.
                // Hay que descontarle ese monto de su billetera virtual (aumenta deuda).
                if (orderData.paymentMethod === 'cash' || orderData.paymentMethod === 'efectivo') {
                    const riderRef = doc(firestore, 'users', user.uid);
                    await updateDoc(riderRef, {
                        walletBalance: increment(-(orderData.totalAmount || 0))
                    });
                }
            }
            
            // Update the related order document status
            await updateDoc(orderRef, { status: 'delivered' });
    
            toast({ title: "¡Entrega Confirmada!", description: `Pedido para ${stop.retailerName} entregado.` });
    
            if (allDelivered) {
                toast({ title: "¡Ruta Completada!", description: "Has finalizado todas las entregas. Tu pago será procesado." });
                router.push('/redeconomix/prestadores/billetera');
            } else {
                // Notify next customer if there is one
                const nextStop = newStops.find(s => s.status === 'pending');
                if (nextStop) {
                    // In a real app, you would need to fetch the order to get the retailerId for notification
                    // For now, we'll log it.
                    console.log(`Notification would be sent to ${nextStop.retailerName}`);
                }
            }
        } catch (error) {
            console.error("Error confirming delivery:", error);
            toast({ title: "Error", description: "No se pudo confirmar la entrega.", variant: "destructive" });
        } finally {
            setProcessingId(null);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!route) {
        return <div className="text-center py-16">Ruta no encontrada.</div>;
    }
    
    const completedStops = route.stops.filter((s: Stop) => s.status === 'delivered').length;
    const progress = (completedStops / route.totalStops) * 100;

    return (
        <div className="container mx-auto py-8 max-w-2xl">
            <div className="mb-4">
                <Button variant="ghost" asChild>
                    <Link href="/redeconomix/prestadores/servicios-activos">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Servicios Activos
                    </Link>
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Mi Ruta de Reparto</CardTitle>
                    <CardDescription>Reparto para <span className="font-semibold">{route.wholesalerName}</span> - {route.totalStops} paradas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {route.status === 'assigned' && (
                        <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg text-center space-y-4">
                            <h3 className="font-semibold">Pendiente de Retiro</h3>
                            <p className="text-sm text-muted-foreground">Dirigite al depósito del mayorista para retirar la mercadería. Presioná el botón cuando hayas cargado todo.</p>
                            <Button onClick={handlePickupConfirmation} disabled={!!processingId}>
                                {processingId === 'pickup' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Package className="mr-2 h-4 w-4" />}
                                Carga Retirada
                            </Button>
                        </div>
                    )}
                    {route.status === 'in_progress' && (
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-medium">Progreso de la Ruta</span>
                                    <span className="text-sm font-bold">{completedStops} / {route.totalStops}</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2.5">
                                    <div className="bg-primary h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                            
                            <Separator />
                            
                            <h3 className="font-semibold">Paradas de Entrega:</h3>
                            <div className="space-y-4">
                                {route.stops.map((stop: Stop, index: number) => {
                                    const isDelivered = stop.status === 'delivered';
                                    const isProcessing = processingId === stop.orderId;
                                    return (
                                        <Card key={stop.orderId} className={cn("flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4", isDelivered && "bg-muted/50")}>
                                            <div className="flex items-center gap-3">
                                                <div className={cn("flex h-8 w-8 items-center justify-center rounded-full font-bold", isDelivered ? "bg-green-500 text-white" : "bg-primary text-primary-foreground")}>
                                                    {isDelivered ? <Check /> : index + 1}
                                                </div>
                                                <div>
                                                    <p className="font-bold">{stop.retailerName}</p>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm text-muted-foreground">{stop.address}</p>
                                                        {!isDelivered && (
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-primary hover:text-primary/80" asChild>
                                                                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`} target="_blank" rel="noopener noreferrer">
                                                                    <Navigation className="h-4 w-4" />
                                                                </a>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="w-full sm:w-auto sm:ml-auto">
                                                {isDelivered ? (
                                                    <Badge variant="default" className="bg-green-600 hover:bg-green-700">Entregado</Badge>
                                                ) : (
                                                    <Button className="w-full" onClick={() => handleDeliveryConfirmation(index)} disabled={isProcessing}>
                                                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                                        Marcar como Entregado
                                                    </Button>
                                                )}
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
