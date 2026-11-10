'use client';

import React, { useState } from 'react';
import { 
    Zap, Award, Gift, Heart, TrendingUp, Clock, 
    ShieldCheck, Banknote, Users, Sparkles, ChevronRight,
    CircleDollarSign, Percent, BadgeCheck, Share2, Info, Rocket, X, Copy,
    MapPin, Navigation, ShoppingBag, Star, ArrowRight, Instagram, Facebook, Link2, Send, Loader2,
    Trophy, Smartphone
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { useUser, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { cn } from '@/lib/utils';
import { Clipboard } from '@capacitor/clipboard';
import { Share } from '@capacitor/share';

export default function ExtrasPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [socialUrl, setSocialUrl] = useState('');

    const socialQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, "socialMissions"), where("providerId", "==", user.uid));
    }, [firestore, user]);
    const { data: socialMissionsData } = useCollection(socialQuery);

    const commsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, "commissions"), where("referrerId", "==", user.uid));
    }, [firestore, user]);
    const { data: commissionsData } = useCollection(commsQuery);

    const referralLink = user ? `https://www.redeconomix.com/register?ref=${user.uid}` : 'https://www.redeconomix.com/register';

    const copyLink = async () => {
        try {
            await Clipboard.write({ string: referralLink });
            toast({ title: "Link copiado", description: "Ya podés compartir tu link rastreable.", className: "bg-slate-900 text-white rounded-[2rem]" });
        } catch (error) {
            console.error("Clipboard error:", error);
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(referralLink);
                toast({ title: "Link copiado", description: "Ya podés compartir tu link rastreable.", className: "bg-slate-900 text-white rounded-[2rem]" });
            }
        }
    };

    const handleShareInvite = async () => {
        try {
            await Share.share({
                title: 'Sumate a RedEconomiX',
                text: '¡Hola! Sumate a RedEconomiX conmigo y empezá a ganar dinero hoy.',
                url: referralLink,
                dialogTitle: 'Invitar contactos'
            });
        } catch (error) {
            console.error("Share error:", error);
            const message = `¡Hola! Sumate a RedEconomiX conmigo y empezá a ganar dinero hoy. Descargá la app aquí: ${referralLink}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
        }
    };

    const handleSaveLink = async () => {
        if (!socialUrl || !user || !firestore) return;
        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'socialMissions'), {
                providerId: user.uid,
                providerName: user.displayName || 'Prestador',
                url: socialUrl,
                status: 'pending',
                createdAt: serverTimestamp(),
                type: 'social_post'
            });
            
            setSocialUrl('');
            toast({ 
                title: "Enlace grabado", 
                description: "Tu publicidad ha sido enviada a auditoría.", 
                className: "bg-primary text-white rounded-[2rem]" 
            });
        } catch (error) {
            console.error("Error saving mission:", error);
            toast({ title: "Error", description: "No se pudo grabar el enlace.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container max-w-2xl mx-auto py-8 px-4 sm:px-6 pb-40 sm:pb-48 bg-slate-50 min-h-screen font-sans animate-in fade-in duration-500">
            
            {/* SECCIÓN 1: MISIONES DIARIAS */}
            <div className="text-center space-y-2 mb-8">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Misiones Diarias</h1>
                <p className="text-xs sm:text-sm font-medium text-slate-400">Publicá en redes y generá ingresos extra hoy mismo.</p>
            </div>

            <Card className="rounded-[2.5rem] sm:rounded-[3rem] border-none shadow-sm bg-white p-6 sm:p-8 mb-10 border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <Smartphone className="h-8 w-8 text-primary shrink-0" />
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">Publicidad<br className="hidden sm:block"/> Social</h2>
                    </div>
                    <div className="bg-primary text-white px-4 py-2 rounded-xl text-[10px] font-black w-fit self-start sm:self-auto">{socialMissionsData?.length || 0} / 20 HOY</div>
                </div>

                <div className="bg-primary rounded-[2rem] p-6 sm:p-8 text-white relative overflow-hidden mb-8 shadow-xl shadow-red-100">
                    <div className="relative z-10 flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center">
                        <Info className="h-8 w-8 text-white shrink-0" />
                        <div className="space-y-3">
                            <h3 className="text-base sm:text-lg font-black uppercase tracking-tight">¿Cómo funciona?</h3>
                            <div className="space-y-2 text-xs font-medium text-white/90">
                                <p>1. Publicá sobre nuestra red en Facebook o grupos.</p>
                                <p>2. Copiá el enlace de tu publicación.</p>
                                <p>3. Pegalo aquí abajo y presioná Grabar.</p>
                                <p className="font-black text-primary-foreground mt-4 text-[13px]">¡Ganá dinero por cada anuncio aprobado!</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pegá tu link de publicidad aquí</p>
                    <div className="flex flex-col gap-3">
                        <Input 
                            placeholder="https://facebook.com/groups" 
                            value={socialUrl}
                            onChange={e => setSocialUrl(e.target.value)}
                            className="h-14 rounded-2xl bg-slate-50 border-none px-6 font-medium text-slate-600 text-center"
                        />
                        <Button 
                            onClick={handleSaveLink}
                            disabled={!socialUrl || isSubmitting}
                            className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-widest shadow-xl shadow-red-100 active:scale-95 transition-all"
                        >
                            {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : "Grabar"}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* SECCIÓN 2: EXPANDÍ TU RED */}
            <Card className="rounded-[2.5rem] sm:rounded-[3rem] border-none shadow-2xl bg-slate-950 p-8 sm:p-10 text-center text-white mb-10 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent opacity-50" />
                <div className="relative z-10 space-y-8">
                    <div className="space-y-2">
                        <h2 className="text-3xl font-black tracking-tight">Expandí tu Red</h2>
                        <p className="text-sm font-medium text-white/40">Invitá amigos y ganá dinero real por cada nuevo socio.</p>
                    </div>
                    
                    <div className="py-4">
                        <Gift className="h-20 w-20 sm:h-24 sm:w-24 text-white mx-auto drop-shadow-2xl opacity-90" />
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-3xl font-black text-white">¡Ganá comisiones!</h3>
                        <p className="text-xs font-medium text-white/50 leading-relaxed max-w-[220px] mx-auto">Invitá a amigos a unirse a la comunidad y ganá dinero extra cuando comiencen a operar.</p>
                    </div>

                    <Button onClick={handleShareInvite} className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-widest shadow-2xl shadow-primary/20 active:scale-95 transition-all">
                        Invitar Contactos
                    </Button>
                </div>
            </Card>

            {/* SECCIÓN 3: TU CARRERA */}
            <div className="text-center space-y-2 mb-8">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Tu Carrera</h2>
                <p className="text-sm font-medium text-slate-400">Expandí tu red para aumentar tus beneficios.</p>
            </div>

            <Card className="rounded-[2.5rem] sm:rounded-[3rem] border-none shadow-sm bg-white p-6 sm:p-8 space-y-8 border border-slate-100">
                <div className="flex flex-row gap-4 items-start">
                    <Trophy className="h-10 w-10 sm:h-12 sm:w-12 text-primary shrink-0 mt-1" />
                    <div className="space-y-2">
                        <h3 className="text-xl font-black text-slate-900 leading-tight">¿Cómo ganar más?</h3>
                        <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">Llevate comisiones fijas de las transacciones que hace tu red de invitados. Compartí tu link para que se sumen.</p>
                        <p className="text-xs sm:text-sm font-bold text-primary">Pronto podrás desbloquear nuevos niveles y beneficios exclusivos.</p>
                    </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-slate-50">
                    <div className="p-5 sm:p-6 rounded-[2rem] bg-slate-50 border border-slate-100 flex flex-col items-center gap-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Tu link de invitado</p>
                        <p className="text-xs font-bold text-primary truncate w-full text-center px-2">{referralLink}</p>
                        <Button onClick={copyLink} className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800">Copiar link de referido</Button>
                    </div>
                    <div className="flex justify-between items-end">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nivel Base</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-primary">1.0%</span>
                                <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest">Cashback</span>
                            </div>
                        </div>
                        <div className="text-right space-y-1">
                            <p className="text-2xl font-black text-slate-900">{commissionsData?.length || 0}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amigos</p>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(((commissionsData?.length || 0) / 5) * 100, 100)}%` }} />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            <p className="text-xs font-bold text-slate-400">Invitá {(commissionsData?.length || 0) >= 5 ? 0 : 5 - (commissionsData?.length || 0)} amigos más para subir de nivel.</p>
                        </div>
                    </div>
                </div>
            </Card>

        </div>
    );
}
