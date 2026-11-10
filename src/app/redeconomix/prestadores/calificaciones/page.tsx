'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Star } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
                <Star
                    key={i}
                    className={`h-5 w-5 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                />
            ))}
        </div>
    );
}

export default function CalificacionesPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const completedServicesQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, "serviceRequests"),
            where("providerId", "==", user.uid),
            where("status", "in", ["completed", "reception_confirmed"]),
            where("rating", ">", 0), // Only get services that have a rating
            orderBy("rating", "desc")
        );
    }, [firestore, user]);

    const { data: services, isLoading: isLoadingServices } = useCollection(completedServicesQuery);

    const stats = useMemo(() => {
        if (!services || services.length === 0) return { averageRating: 0, reviewCount: 0 };
        const reviewCount = services.length;
        const totalRating = services.reduce((sum, service) => sum + service.rating, 0);
        const averageRating = totalRating / reviewCount;
        return { averageRating, reviewCount };
    }, [services]);

    if (isUserLoading || isLoadingServices) {
        return <div className="flex justify-center items-center h-screen bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }

    return (
        <div className="container max-w-4xl mx-auto py-12 px-4 space-y-12">
            <div className="space-y-2">
                <h1 className="text-4xl font-bold  uppercase tracking-tight text-slate-900 leading-none">Mi <span className="text-primary ">Reputación</span></h1>
                <p className="text-slate-400 font-medium text-xs leading-relaxed">Lo que los clientes dicen sobre tu profesionalismo</p>
            </div>
            <Card className="rounded-[3rem] bg-primary border-none shadow-2xl shadow-red-500/30 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Star className="h-32 w-32 text-white fill-white rotate-12" />
                </div>
                <CardHeader className="items-center text-center p-12 space-y-4 relative z-10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">Puntaje Global Elite</p>
                    <div className="flex items-center gap-4 text-7xl font-bold  tracking-tight text-white">
                        {stats.averageRating.toFixed(1)}
                    </div>
                    <div className="flex justify-center">
                        <StarRating rating={Math.round(stats.averageRating)} />
                    </div>
                    <CardDescription className="text-xs font-bold text-white/60 uppercase tracking-widest">Basado en {stats.reviewCount} experiencias de clientes</CardDescription>
                </CardHeader>
            </Card>

            <Card className="rounded-[2.5rem] bg-white border border-slate-100 shadow-xl overflow-hidden">
                <CardHeader className="p-8 border-b border-slate-50 bg-slate-50/30">
                    <CardTitle className="text-xl font-bold  uppercase tracking-tight text-slate-900">Opiniones de la Comunidad</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {services && services.length > 0 ? (
                        <div className="divide-y divide-slate-50">
                            {services.map(service => (
                                <div key={service.id} className="p-8 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-12 w-12 border-2 border-white shadow-sm ring-2 ring-slate-100">
                                                <AvatarFallback className="bg-primary text-white font-bold uppercase text-sm">{(service.clientName || 'C').charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="space-y-0.5">
                                                <p className="text-sm font-bold  uppercase tracking-tight text-slate-900">{service.clientName || 'Cliente Red'}</p>
                                                <p className="text-xs font-medium text-slate-400 leading-none">{service.createdAt?.toDate ? new Date(service.createdAt.toDate()).toLocaleDateString('es-AR') : 'Reciente'}</p>
                                            </div>
                                        </div>
                                        <div className="bg-slate-100/50 px-4 py-2 rounded-2xl border border-slate-100 flex items-center h-10">
                                            <StarRating rating={service.rating} />
                                        </div>
                                    </div>
                                    {(service.comment || service.clientFeedback) && (
                                        <div className="mt-6 pt-6 border-t border-slate-50">
                                            <p className="text-sm font-medium text-slate-500  leading-relaxed pl-4 border-l-2 border-primary/20">
                                                "{service.comment || service.clientFeedback}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 text-center space-y-4">
                            <Star className="h-10 w-10 text-slate-100 mx-auto" />
                            <p className="text-xs font-bold  uppercase tracking-widest text-slate-400">Aún no has recibido <span className="text-primary ">calificaciones</span></p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
