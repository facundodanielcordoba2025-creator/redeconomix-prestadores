'use client';

import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, query, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Check, MapPin, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

export default function TransportesPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const userDocRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userData, isLoading: isLoadingUserData } = useDoc(userDocRef);

    const availableRoutesQuery = useMemoFirebase(() => {
        if (!firestore || !userData?.cityId) return null;
        return query(
            collection(firestore, "deliveryRoutes"), 
            where("status", "==", "pending"),
            where("cityId", "==", userData.cityId)
        );
    }, [firestore, userData]);
    const { data: routes, isLoading: isLoadingRoutes } = useCollection(availableRoutesQuery);

    const handleAcceptRoute = async (routeId: string) => {
        if (!firestore || !user) return;
        setProcessingId(routeId);
        try {
            await updateDoc(doc(firestore, "deliveryRoutes", routeId), {
                carrierId: user.uid,
                status: 'assigned',
            });
            toast({ title: "¡Ruta Aceptada!", description: "La ruta ahora está en tus 'Servicios Activos'." });
            router.push('/redeconomix/prestadores/servicios-activos');
        } catch (error) {
            console.error("Error accepting route:", error);
            toast({ title: "Error", description: "No se pudo aceptar la ruta.", variant: "destructive" });
        } finally {
            setProcessingId(null);
        }
    };
    
    const isLoading = isUserLoading || isLoadingRoutes || isLoadingUserData;

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }

    return (
        <div className="container max-w-4xl mx-auto py-12 px-4 space-y-12">
            <div className="space-y-2">
                <h1 className="text-4xl font-bold  uppercase tracking-tight text-slate-900 leading-none">Rutas <span className="text-primary ">Logísticas</span></h1>
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest leading-relaxed">Transportes de mayoristas esperando asignación</p>
            </div>
            {routes && routes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {routes.map(route => (
                        <Card key={route.id} className="group rounded-[2.5rem] bg-white border border-slate-100 overflow-hidden flex flex-col transition-all hover:border-primary/20 hover:shadow-xl hover:shadow-red-500/5">
                            <CardHeader className="p-8 border-b border-slate-50 flex flex-row items-center justify-between bg-slate-50/30">
                                <div className="space-y-1">
                                    <CardTitle className="text-xl font-bold  uppercase tracking-tight text-slate-900">Ruta de Reparto</CardTitle>
                                    <div className="flex items-center gap-1.5 text-primary font-bold  uppercase text-[10px] tracking-widest">
                                        <Truck className="h-3 w-3" />
                                        {route.wholesalerName}
                                    </div>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border border-slate-100 group-hover:rotate-12 transition-transform">
                                    <MapPin className="h-6 w-6 text-primary" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 space-y-6 flex-grow">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Zona de Cobertura</span>
                                    <Badge className="bg-slate-100 text-slate-600 border-none rounded-full font-bold  uppercase text-[10px] px-4">
                                        {route.zone || 'Global'}
                                    </Badge>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                     <span className="text-xs font-bold uppercase text-slate-400 tracking-widest">Total Paradas</span>
                                     <span className="text-lg font-bold  text-slate-900">{route.totalStops}</span>
                                </div>
                            </CardContent>
                             <CardFooter className="p-8 bg-slate-50 flex flex-col items-center gap-6 border-t border-slate-100">
                                <div className="text-center space-y-1">
                                    <p className="text-[10px] font-bold  uppercase tracking-widest text-slate-400">Compensación Estimada</p>
                                    <p className="text-4xl font-bold  tracking-tight text-primary">${(route.paymentAmount || 0).toLocaleString('es-AR')}</p>
                                </div>
                                <Button 
                                    className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold  uppercase tracking-tight shadow-xl transition-all" 
                                    onClick={() => handleAcceptRoute(route.id)} 
                                    disabled={!!processingId}
                                >
                                    {processingId === route.id ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Check className="mr-2 h-5 w-5" />}
                                    Aceptar Desafío Ruta
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-32 bg-white rounded-[3rem] border border-dashed border-slate-100 space-y-4">
                     <Truck className="h-10 w-10 text-slate-100 mx-auto" />
                    <p className="text-slate-400 font-bold  uppercase tracking-widest text-xs">Sin rutas VIP <span className="text-primary ">disponibles</span></p>
                </div>
            )}
        </div>
    );
}
