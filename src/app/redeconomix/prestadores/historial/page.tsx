'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Star, Truck } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function HistorialPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const completedServicesQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, "serviceRequests"),
            where("providerId", "==", user.uid),
            where("status", "in", ["completed", "reception_confirmed"])
        );
    }, [firestore, user]);
    const { data: services, isLoading: isLoadingServices } = useCollection(completedServicesQuery);
    
    const completedRoutesQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, "deliveryRoutes"),
            where("carrierId", "==", user.uid),
            where("status", "in", ["completed", "reception_confirmed"])
        );
    }, [firestore, user]);
    const { data: routes, isLoading: isLoadingRoutes } = useCollection(completedRoutesQuery);

    const allHistory = useMemo(() => {
        const serviceHistory = services?.map(s => ({...s, type: 'servicio', date: s.createdAt?.toDate ? s.createdAt.toDate() : (s.completedAt?.toDate ? s.completedAt.toDate() : null) })) || [];
        const routeHistory = routes?.map(r => ({...r, type: 'ruta', date: r.completedAt?.toDate ? r.completedAt.toDate() : (r.createdAt?.toDate ? r.createdAt.toDate() : null) })) || [];
        
        const combined = [...serviceHistory, ...routeHistory];
        return combined.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    }, [services, routes]);

    if (isUserLoading || isLoadingServices || isLoadingRoutes) {
        return <div className="flex justify-center items-center h-screen bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }

    return (
        <div className="container max-w-4xl mx-auto py-12 px-4 space-y-12">
            <div className="space-y-2">
                <h1 className="text-4xl font-bold  uppercase tracking-tight text-slate-900 leading-none">Mi <span className="text-primary ">Historial</span></h1>
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest leading-relaxed">Registro de todos tus trabajos y rutas completadas</p>
            </div>
             <Card className="rounded-[3rem] bg-white border border-slate-100 shadow-xl overflow-hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="border-slate-50">
                                <TableHead className="font-bold  uppercase tracking-tight text-[10px] text-slate-400 pl-8 h-12">Fecha</TableHead>
                                <TableHead className="font-bold  uppercase tracking-tight text-[10px] text-slate-400 h-12">Detalle del Trabajo</TableHead>
                                <TableHead className="font-bold  uppercase tracking-tight text-[10px] text-slate-400 text-center h-12">Calificación</TableHead>
                                <TableHead className="font-bold  uppercase tracking-tight text-[10px] text-slate-400 text-right pr-8 h-12">Cobrado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allHistory && allHistory.length > 0 ? (
                                allHistory.map(item => (
                                    <TableRow key={item.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="pl-8 font-bold text-slate-400 text-xs">
                                            {item.date ? new Date(item.date).toLocaleDateString('es-AR') : 'N/A'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-bold  uppercase tracking-tight text-slate-900">{item.type === 'servicio' ? item.serviceType : `Logística VIP`}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
                                                {item.type === 'servicio' ? `Cliente: ${item.clientName}` : `Mayorista: ${item.wholesalerName}`}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {item.type === 'servicio' && item.rating ? (
                                                <div className="flex items-center justify-center gap-1.5 bg-slate-100 py-1.5 px-3 rounded-full inline-flex">
                                                    <span className="font-bold  text-slate-900 text-xs">{item.rating}</span>
                                                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500"/>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-bold uppercase text-slate-300 tracking-widest">{item.type === 'ruta' ? 'N/A' : 'Pendiente'}</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-8 font-bold  tracking-tight text-primary text-base">
                                            ${(item.amountCharged || item.paymentAmount || item.agreedPrice || item.totalPrice || 0).toLocaleString('es-AR')}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">No has completado ningún trabajo todavía.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
