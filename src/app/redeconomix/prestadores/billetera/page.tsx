'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
    Wallet, ArrowUpRight, ArrowDownRight, 
    DollarSign, History, TrendingUp, 
    ArrowRight, Loader2, CheckCircle2,
    Calendar, Package, Truck, Zap,
    Gift, Users, Heart, Star, Award,
    Info, X, ChevronRight, ShieldCheck, Clock,
    MapPin, Layers, Map as MapIcon, Timer, CreditCard,
    ArrowUpCircle, PlusCircle, PieChart, AlertCircle, MessageCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';

export default function BilleteraPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showDoubleModal, setShowDoubleModal] = useState(false);
    const [showReferralModal, setShowReferralModal] = useState(false);

    // 1. Cargar datos reales del usuario (walletBalance)
    const { data: userData, isLoading: isUserDocLoading } = useDoc<any>(
        user && firestore ? doc(firestore, 'users', user.uid) : null
    );

    // 2. Cargar historial de transacciones reales
    const txQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'users', user.uid, 'transactions'),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
    }, [firestore, user]);

    const { data: realTransactions, isLoading: isTxLoading } = useCollection<any>(txQuery as any);

    const referralLink = user ? `https://www.redeconomix.com/register?ref=${user.uid}` : 'https://www.redeconomix.com/register';
    const waMessage = `¡Hola! Te invito a unirte a RedEconomiX. Ahorrá en tus compras mayoristas o generá ingresos extras como yo. Registrate aquí: ${referralLink}`;

    const handleShareWA = () => {
        const url = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;
        window.open(url, '_blank');
    };

    const balance = Number(userData?.walletBalance || 0);

    const computedStats = useMemo(() => {
        if (!realTransactions || realTransactions.length === 0) {
            return { todayAmount: 0, propinasAmount: 0, referidosAmount: 0 };
        }
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        let todayAmount = 0;
        let propinasAmount = 0;
        let referidosAmount = 0;
        realTransactions.forEach((tx: any) => {
            const amt = Number(tx.amount || 0);
            if (amt <= 0) return;
            const txDate = tx.createdAt?.toDate ? tx.createdAt.toDate().getTime() : 0;
            if (txDate >= startOfToday) {
                todayAmount += amt;
            }
            const txType = (tx.type || '').toUpperCase();
            if (txType.includes('PROPINA') || txType.includes('TIP')) {
                propinasAmount += amt;
            }
            if (txType.includes('REFERIDO') || txType.includes('REFERRAL')) {
                referidosAmount += amt;
            }
        });
        return { todayAmount, propinasAmount, referidosAmount };
    }, [realTransactions]);

    const stats = { 
        total: `$${balance.toLocaleString('es-AR')}`, 
        today: `$${computedStats.todayAmount.toLocaleString('es-AR')}`,
        propinas: `$${computedStats.propinasAmount.toLocaleString('es-AR')}`, 
        referidos: `$${computedStats.referidosAmount.toLocaleString('es-AR')}`,
        bankAccount: userData?.banking?.cbu ? `CBU: ${userData.banking.cbu.slice(0,10)}...` : "SIN CBU CARGADO"
    };

    const handleConfirmWithdraw = async () => {
        if (!firestore || !user) return;
        setIsWithdrawing(true);
        try {
            await addDoc(collection(firestore, 'withdrawal_requests'), {
                userId: user.uid,
                amount: balance,
                status: 'pending',
                createdAt: serverTimestamp()
            });
            toast({ title: "Solicitud enviada", description: "Tu solicitud de retiro fue registrada correctamente." });
            setShowWithdrawModal(false);
        } catch (error) {
            console.error("Error creating withdrawal request:", error);
            toast({ title: "Error", description: "No se pudo procesar el retiro.", variant: "destructive" });
        } finally {
            setIsWithdrawing(false);
        }
    };

    const transactions = realTransactions?.map(tx => ({
        id: tx.id,
        type: tx.type || 'MOVIMIENTO',
        amount: `${tx.amount > 0 ? '+' : ''}$${Math.abs(tx.amount || 0).toLocaleString('es-AR')}`,
        date: tx.createdAt?.toDate ? new Date(tx.createdAt.toDate()).toLocaleDateString('es-AR') : 'Reciente',
        icon: tx.type === 'PREMIO' ? Award : tx.type === 'REFERIDO' ? Users : Package,
        color: tx.amount < 0 ? 'text-slate-900' : 'text-primary'
    })) || [];

    if (isUserLoading) return <div className="flex justify-center items-center h-screen bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 pb-32">
            
            <main className="container max-w-2xl mx-auto py-8 px-6 space-y-10">
                
                <Card className="rounded-[3rem] bg-primary text-white border-none shadow-2xl overflow-hidden">
                    <CardContent className="p-10 space-y-10 relative">
                        <div className="absolute top-0 right-0 p-10 opacity-10"><PieChart className="h-40 w-40" /></div>
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60">SALDO DISPONIBLE</p>
                            <h2 className="text-6xl font-black tracking-tighter">{stats.total}</h2>
                        </div>
                        <Button onClick={() => setShowWithdrawModal(true)} className="w-full h-16 max-sm:h-12 rounded-2xl bg-white text-primary font-black uppercase text-[10px] shadow-xl hover:bg-slate-100">RETIRAR DINERO</Button>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">INTERESANTE</p>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x px-1">
                        <Card className="min-w-[280px] snap-center rounded-[2.5rem] bg-primary text-white border-none shadow-xl p-8 relative overflow-hidden group cursor-pointer flex flex-col justify-between" onClick={() => setShowReferralModal(true)}>
                            <div className="absolute right-0 top-0 p-4 opacity-20"><Users className="h-20 max-sm:h-14 w-20" /></div>
                            <h3 className="text-lg font-black uppercase leading-tight mb-6">COMPARTÍ Y GANÁ DINERO EXTRA</h3>
                            <Button className="h-10 w-full rounded-xl font-black uppercase text-[8px] px-6 bg-white text-primary border-none hover:bg-slate-100" onClick={(e) => { e.stopPropagation(); setShowReferralModal(true); }}>SABER CÓMO</Button>
                        </Card>
                        <Card className="min-w-[280px] snap-center rounded-[2.5rem] bg-primary text-white border-none shadow-xl p-8 relative overflow-hidden flex flex-col justify-between">
                            <div className="absolute right-0 top-0 p-4 opacity-20"><Info className="h-20 max-sm:h-14 w-20" /></div>
                            <h3 className="text-lg font-black uppercase leading-tight mb-6">¿POR QUÉ SER PRESTADOR ES MEJOR?</h3>
                            <Button className="h-10 w-full rounded-xl font-black uppercase text-[8px] px-6 bg-white text-primary border-none hover:bg-slate-100" onClick={() => setShowInfoModal(true)}>SABER MÁS</Button>
                        </Card>
                        <Card className="min-w-[280px] snap-center rounded-[2.5rem] bg-primary text-white border-none shadow-xl p-8 relative overflow-hidden flex flex-col justify-between">
                            <div className="absolute right-0 top-0 p-4 opacity-20"><Zap className="h-20 max-sm:h-14 w-20" /></div>
                            <h3 className="text-lg font-black uppercase leading-tight mb-6">¡GANA MÁS CON PEDIDOS DOBLES!</h3>
                            <Button className="h-10 w-full rounded-xl font-black uppercase text-[8px] px-6 bg-white text-primary border-none hover:bg-slate-100" onClick={() => setShowDoubleModal(true)}>VER CAMBIOS</Button>
                        </Card>
                    </div>

                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Card className="rounded-[2.5rem] bg-white border border-slate-100 p-6 shadow-sm"><Heart className="h-5 w-5 text-primary fill-primary mb-4" /><p className="text-[9px] font-black text-slate-400 uppercase">PROPINAS</p><p className="text-xl font-black text-slate-900 mt-1">{stats.propinas}</p></Card>
                    <Card className="rounded-[2.5rem] bg-white border border-slate-100 p-6 shadow-sm"><Users className="h-5 w-5 text-primary mb-4" /><p className="text-[9px] font-black text-slate-400 uppercase">REFERIDOS</p><p className="text-xl font-black text-slate-900 mt-1">{stats.referidos}</p></Card>
                </div>

                <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">ÚLTIMOS MOVIMIENTOS</p>
                    <div className="space-y-3">
                        {transactions.map((tx) => (
                            <div key={tx.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center"><tx.icon className="h-6 w-6 text-primary" /></div><div><p className="text-xs font-black uppercase text-slate-900">{tx.type}</p><p className="text-[9px] font-bold text-slate-400 uppercase">{tx.date}</p></div></div>
                                <p className={cn("text-lg font-black", tx.color)}>{tx.amount}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* MODAL REFERIDOS (EL GENERADOR DE INGRESOS) */}
            <Dialog open={showReferralModal} onOpenChange={setShowReferralModal}>
                <DialogContent className="rounded-[2rem] p-6 w-[88vw] max-w-sm max-h-[75vh] overflow-y-auto border-none shadow-2xl">
                    <DialogHeader className="mb-8"><DialogTitle className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-tight">COMPARTÍ Y GANÁ</DialogTitle><p className="text-[10px] font-bold text-primary uppercase mt-2">Diferentes formas de generar ingresos</p></DialogHeader>
                    <div className="space-y-10">
                        <section className="space-y-3"><div className="flex items-center gap-3"><Package className="h-5 w-5 text-primary" /><h4 className="text-sm font-black uppercase">Consumo Marketplace</h4></div><p className="text-xs font-medium text-slate-600 leading-relaxed">Ganá dinero invitando a tus amigos y familiares a comprar en RedEconomix. Recibí comisiones por sus pedidos.</p></section>
                        <section className="space-y-3"><div className="flex items-center gap-3"><Truck className="h-5 w-5 text-primary" /><h4 className="text-sm font-black uppercase">Nuevos Prestadores</h4></div><p className="text-xs font-medium text-slate-600 leading-relaxed">Invitá a personas a trabajar en la aplicación. Ganá un bono cuando completen sus primeras entregas.</p></section>
                        <section className="space-y-3"><div className="flex items-center gap-3"><Star className="h-5 w-5 text-primary fill-primary" /><h4 className="text-sm font-black uppercase">Asociado Premium (VIP)</h4></div><p className="text-xs font-medium text-slate-600 leading-relaxed">Si tu recomendado descarga y se asocia como asociado premium, <span className="font-black text-slate-900">ganarás dinero durante 2 meses consecutivos</span>.</p></section>
                        <div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col items-center gap-4"><p className="text-[10px] font-black text-slate-900 uppercase">TU LINK PERSONALIZADO</p><p className="text-[10px] font-bold text-primary break-all text-center">{referralLink}</p><Button variant="outline" className="h-10 rounded-xl font-black uppercase text-[8px] px-6 border-slate-200" onClick={() => { navigator.clipboard.writeText(referralLink); toast({ title: "LINK COPIADO", className: "bg-slate-900 text-white rounded-3xl" }); }}>COPIAR LINK</Button></div>
                    </div>
                    <div className="mt-10 pt-6 border-t border-slate-100"><Button onClick={handleShareWA} className="w-full h-16 max-sm:h-12 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 shadow-xl"><MessageCircle className="h-6 w-6" /> COMPARTIR POR WHATSAPP</Button></div>
                </DialogContent>
            </Dialog>

            {/* MODAL 6 RAZONES (RESTAURADO COMPLETO) */}
            <Dialog open={showInfoModal} onOpenChange={setShowInfoModal}>
                <DialogContent className="rounded-[2rem] p-6 w-[88vw] max-w-sm max-h-[75vh] overflow-y-auto border-none shadow-2xl">
                    <DialogHeader className="mb-8"><DialogTitle className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-tight">¿Por qué prestar servicios RedServicios es siempre mejor?</DialogTitle><p className="text-[10px] font-bold text-primary uppercase mt-2 tracking-widest">6 Razones por las que los mejores nos prefieren</p></DialogHeader>
                    <div className="space-y-10">
                        <section className="space-y-3"><div className="flex items-center gap-3"><span className="text-2xl font-black text-primary">01</span><h4 className="text-sm font-black uppercase">Ganancias</h4></div><div className="text-xs font-medium text-slate-600 leading-relaxed">Sabemos que estás en RedServicios para ganar dinero, por eso todo lo que hacemos está pensado para que obtengas con nuestra app las mejores ganancias posibles.<br/><br/><span className="font-black text-slate-900">Muchas fuentes de ingresos:</span><ul className="list-disc pl-5 mt-2 space-y-2"><li><span className="font-bold">Pedidos entregados:</span> Recibí ganancias con cada entrega que haces.</li><li><span className="font-bold">100% de las propinas:</span> El cliente puede darte propina antes, durante y después de la entrega.</li><li><span className="font-bold">Referir tus conocidos:</span> Ganá dinero invitando a tus amigos y familiares. Si tu recomendado se asocia como asociado premium, podés ganar dinero durante 2 meses.</li><li><span className="font-bold">Participar en recompensas:</span> Promedio 5 estrellas en 9 de 10 pedidos = Bono extra de $100.000.</li></ul></div></section>
                        <section className="space-y-3"><div className="flex items-center gap-3"><span className="text-2xl font-black text-primary">02</span><h4 className="text-sm font-black uppercase">Pago semanal</h4></div><p className="text-xs font-medium text-slate-600 leading-relaxed">Todo lo que ganés en una semana lo recibís en la siguiente directamente en tu cuenta bancaria.</p></section>
                        <section className="space-y-3"><div className="flex items-center gap-3"><span className="text-2xl font-black text-primary">03</span><h4 className="text-sm font-black uppercase">Flexibilidad</h4></div><p className="text-xs font-medium text-slate-600 leading-relaxed">Conéctate cuando y donde quieras. Podés trabajar en diferentes localidades. Organizá el tiempo como vos prefieras.</p></section>
                        <section className="space-y-3"><div className="flex items-center gap-3"><span className="text-2xl font-black text-primary">04</span><h4 className="text-sm font-black uppercase">Registro rápido</h4></div><p className="text-xs font-medium text-slate-600 leading-relaxed">Regístrate en minutos y obtendrás la aprobación en menos de 1 día. Empezá a ganar dinero hoy mismo.</p></section>
                        <section className="space-y-3"><div className="flex items-center gap-3"><span className="text-2xl font-black text-primary">05</span><h4 className="text-sm font-black uppercase">Beneficios exclusivos</h4></div><p className="text-xs font-medium text-slate-600 leading-relaxed">Seguro contra accidentes, descuentos en farmacias, aporte jubilatorio, microcreditos y mas desde el 2 mes.</p></section>
                        <section className="space-y-3"><div className="flex items-center gap-3"><span className="text-2xl font-black text-primary">06</span><h4 className="text-sm font-black uppercase">Meritocracia</h4></div><p className="text-xs font-medium text-slate-600 leading-relaxed">Más pedidos y mejor servicio = Estado más alto y mayores ingresos.</p></section>
                    </div>
                    <Button onClick={() => setShowInfoModal(false)} className="w-full h-16 max-sm:h-12 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[10px] mt-10">¡VAMOS A GANAR!</Button>
                </DialogContent>
            </Dialog>

            {/* MODAL PEDIDOS DOBLES (RESTAURADO COMPLETO) */}
            <Dialog open={showDoubleModal} onOpenChange={setShowDoubleModal}>
                <DialogContent className="rounded-[2rem] p-6 w-[88vw] max-w-sm max-h-[75vh] overflow-y-auto border-none shadow-2xl">
                    <DialogHeader className="text-center mb-8"><DialogTitle className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-tight">CAMBIOS EN PEDIDOS DOBLES</DialogTitle><p className="text-[10px] font-bold text-primary uppercase mt-2">¡Más veloz, más ganancias!</p></DialogHeader>
                    <div className="space-y-8">
                        <div className="space-y-6">
                            <div className="flex gap-4"><div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0"><ShieldCheck className="h-6 w-6" /></div><div><h4 className="text-sm font-black uppercase">PAGOS EN CANCELADOS</h4><p className="text-[10px] font-medium text-slate-500 mt-1">Si un pedido se cancela, recibís un pago justo por el esfuerzo.</p></div></div>
                            <div className="flex gap-4"><div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0"><Layers className="h-6 w-6" /></div><div><h4 className="text-sm font-black uppercase">PEDIDOS MÁS CLAROS</h4><p className="text-[10px] font-medium text-slate-500 mt-1">Vista paso a paso y descripción clave para evitar confusiones.</p></div></div>
                            <div className="flex gap-4"><div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0"><Zap className="h-6 w-6" /></div><div><h4 className="text-sm font-black uppercase">RUTAS SUGERIDAS RÁPIDAS</h4><p className="text-[10px] font-medium text-slate-500 mt-1">Ahorrá hasta un 33% de tu tiempo con rutas optimizadas.</p></div></div>
                        </div>
                    </div>
                    <Button onClick={() => setShowDoubleModal(false)} className="w-full h-16 max-sm:h-12 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[10px] mt-10">¡VAMOS!</Button>
                </DialogContent>
            </Dialog>

            {/* MODAL RETIRO (RESTAURADO COMPLETO) */}
            <Dialog open={showWithdrawModal} onOpenChange={setShowWithdrawModal}>
                <DialogContent className="rounded-[2rem] p-6 w-[88vw] max-w-sm border-none shadow-2xl">
                    <DialogHeader className="text-center mb-6"><DialogTitle className="text-2xl font-black uppercase tracking-tighter">PROTOCOLO DE PAGO</DialogTitle></DialogHeader>
                    <div className="space-y-6">
                        <div className="flex gap-4 p-6 bg-red-50 rounded-[2rem] border border-red-100">
                            <AlertCircle className="h-6 w-6 text-primary shrink-0" /><div className="space-y-2"><p className="text-[10px] font-black uppercase text-primary">PRIMER RETIRO PENDIENTE</p><p className="text-xs font-bold text-slate-700 leading-relaxed">Deben transcurrir <span className="underline">7 DÍAS HÁBILES</span> para validación técnica.</p></div>
                        </div>
                    </div>
                    <Button onClick={handleConfirmWithdraw} disabled={isWithdrawing} className="w-full h-16 max-sm:h-12 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[10px] mt-8">
                        {isWithdrawing ? <Loader2 className="h-5 w-5 animate-spin" /> : "CONFIRMAR"}
                    </Button>
                </DialogContent>
            </Dialog>

        </div>
    );
}
