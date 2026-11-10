'use client';

import { useState, useRef, useEffect, use } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Send, ArrowLeft, Camera, Image as ImageIcon, MapPin, CheckCircle, Package, Clock, Phone, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { storage } from '@/firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const serviceId = id;
    
    const serviceRequestDocRef = useMemoFirebase(() => {
        if (!firestore || !serviceId) return null;
        return doc(firestore, 'serviceRequests', serviceId);
    }, [firestore, serviceId]);
    const { data: serviceRequest, isLoading: isLoadingServiceRequest } = useDoc(serviceRequestDocRef);

    const messagesQuery = useMemoFirebase(() => {
        if (!firestore || !serviceId) return null;
        return query(
            collection(firestore, `serviceRequests/${serviceId}/messages`),
            orderBy('createdAt', 'asc')
        );
    }, [firestore, serviceId]);

    const { data: messages, isLoading: isLoadingMessages } = useCollection(messagesQuery);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e?: React.FormEvent, imageUrl?: string) => {
        if (e) e.preventDefault();
        if (!firestore || !user || (!newMessage.trim() && !imageUrl) || !serviceId) return;

        setIsSending(true);
        try {
            await addDoc(collection(firestore, `serviceRequests/${serviceId}/messages`), {
                text: newMessage || '',
                imageUrl: imageUrl || null,
                senderId: user.uid,
                createdAt: serverTimestamp(),
                senderName: user.displayName || 'Prestador'
            });
            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !firestore || !user) return;

        setIsUploading(true);
        try {
            const storageRef = ref(storage, `chat_evidence/${serviceId}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);
            await handleSendMessage(undefined, url);
            toast({ title: "Imagen enviada", description: "La evidencia se cargó correctamente." });
        } catch (error) {
            console.error("Upload error:", error);
            toast({ title: "Error de carga", description: "No se pudo subir la imagen.", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    const handleQuickStatusUpdate = async () => {
        if (!firestore || !serviceRequest) return;
        const nextStatusMap: Record<string, string> = {
            'confirmed': 'on_the_way',
            'on_the_way': 'arriving',
            'arriving': 'in_progress',
            'in_progress': 'completed'
        };
        const next = nextStatusMap[serviceRequest.status];
        if (!next) return;

        try {
            await updateDoc(doc(firestore, 'serviceRequests', serviceId), { status: next });
            toast({ title: "Estado Actualizado", description: `Nuevo estado: ${next}` });
        } catch (e) {
            toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
        }
    };
    
    if (isUserLoading || isLoadingMessages || isLoadingServiceRequest) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="h-[100dvh] bg-[#F4F5F8] flex flex-col font-sans overflow-hidden">
            {/* Header Terminal */}
            <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild className="rounded-xl h-10 w-10">
                        <Link href="/redeconomix/prestadores/servicios-activos"><ArrowLeft className="h-5 w-5" /></Link>
                    </Button>
                    <div className="space-y-0.5">
                        <h2 className="text-sm font-bold uppercase tracking-tight text-slate-900">{serviceRequest?.serviceType || 'Servicio'}</h2>
                        <div className="flex items-center gap-2">
                             <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                             <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Canal Seguro L99</span>
                        </div>
                    </div>
                </div>
                <Badge className="bg-primary/10 text-primary border-none rounded-full px-4 py-1 text-[9px] font-bold uppercase">
                    {serviceRequest?.status || 'Active'}
                </Badge>
            </header>

            {/* Service Action Panel */}
            <div className="bg-white border-b border-slate-100 p-4 px-6 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-3 shrink-0">
                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                        <User className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest mb-0.5">Cliente</p>
                        <p className="text-xs font-bold text-slate-700">{serviceRequest?.clientName || '...'}</p>
                    </div>
                </div>
                <div className="h-10 w-[1px] bg-slate-100 shrink-0" />
                <Button onClick={handleQuickStatusUpdate} variant="outline" className="h-11 rounded-xl border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-600 px-6 hover:bg-slate-50 transition-all shrink-0">
                    Actualizar Estado <ArrowRight className="ml-2 h-3.5 w-3.5 text-primary" />
                </Button>
            </div>

            {/* Chat Body */}
            <CardContent className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 flex flex-col no-scrollbar">
                <div className="flex flex-col gap-6 flex-1 justify-end">
                    {messages?.map(msg => (
                        <div key={msg.id} className={cn("flex flex-col", msg.senderId === user?.uid ? "items-end" : "items-start")}>
                            <div className={cn(
                                "max-w-[85%] p-4 shadow-sm relative",
                                msg.senderId === user?.uid 
                                    ? "bg-slate-900 text-white rounded-[1.5rem] rounded-tr-none" 
                                    : "bg-white text-slate-900 rounded-[1.5rem] rounded-tl-none border border-slate-100"
                            )}>
                                {msg.imageUrl && (
                                    <div className="mb-3 rounded-xl overflow-hidden border border-white/10">
                                        <img src={msg.imageUrl} alt="Evidence" className="w-full h-auto max-h-64 object-cover" />
                                    </div>
                                )}
                                {msg.text && <p className="text-[13px] font-medium leading-relaxed">{msg.text}</p>}
                                
                                <div className={cn("flex items-center gap-1.5 mt-2 opacity-40", msg.senderId === user?.uid ? "justify-end" : "justify-start")}>
                                     <Clock className="h-2.5 w-2.5" />
                                     <span className="text-[8px] font-bold uppercase">{msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </CardContent>

            {/* Input Bar */}
            <footer className="bg-white border-t border-slate-100 p-4 px-6 pb-8">
                <div className="flex items-center gap-3">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-primary transition-colors border border-slate-100 active:scale-95"
                    >
                        {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                    </button>
                    
                    <div className="flex-1 relative">
                        <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Terminal de Mensajería..."
                            className="h-14 bg-slate-50 border-none rounded-2xl px-6 text-sm font-bold focus-visible:ring-primary/20 placeholder:text-slate-300"
                            disabled={isSending}
                        />
                    </div>

                    <button 
                        onClick={() => handleSendMessage()}
                        disabled={isSending || (!newMessage.trim() && !isUploading)}
                        className="h-14 w-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-red-500/20 active:scale-90 transition-all disabled:opacity-20"
                    >
                        {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </button>
                </div>
            </footer>
        </div>
    );
}

function ArrowRight(props: any) {
    return (
        <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
        </svg>
    )
}
