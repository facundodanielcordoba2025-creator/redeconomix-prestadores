'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useStorage } from '@/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { 
    User, ShieldCheck, DollarSign, Award, 
    Users, Star, Zap, Clock, Calendar, 
    ChevronRight, LogOut, Camera, FileText,
    Heart, TrendingUp, Info, Gift, CheckCircle2,
    Briefcase, MapPin, Phone, Mail, Wallet, Banknote, CreditCard, Loader2, Save,
    ShieldAlert, FilePlus, Upload, Fingerprint, IdCard
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { DNICamera } from '@/components/dni-camera';

export default function PerfilPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();

    // Helper: upload a base64 dataUrl to Firebase Storage and return the download URL
    const uploadImage = async (dataUrl: string, path: string): Promise<string> => {
        if (!storage) throw new Error("Storage no disponible");
        // If it's already a remote URL (from a previous save), just return it
        if (dataUrl.startsWith('http')) return dataUrl;
        const storageRef = ref(storage, path);
        await uploadString(storageRef, dataUrl, 'data_url');
        return await getDownloadURL(storageRef);
    };

    
    const { data: profileData, isLoading: isProfileLoading } = useDoc<any>(
        user ? doc(firestore!, 'users', user.uid) : null
    );

    const [isSaving, setIsSaving] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);

    const [formData, setFormData] = useState({
        firstName: '', lastName: '', dni: '', cbu: '', alias: '', bank: '', cuil: '',
        phone: '', isPublicOfficial: false, officialId: '', hasCriminalRecord: false,
        categories: [] as string[],
        photoURL: '', dniFrontURL: '', dniBackURL: ''
    });
    
    // Scanner states
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerTarget, setScannerTarget] = useState<'dniFrontURL' | 'dniBackURL' | null>(null);

    useEffect(() => {
        if (profileData && initialLoad) {
            setFormData({
                firstName: profileData.firstName || '',
                lastName: profileData.lastName || '',
                dni: profileData.dni || '',
                cbu: profileData.banking?.cbu || profileData.cbu || '',
                alias: profileData.banking?.alias || profileData.alias || '',
                bank: profileData.banking?.bank || profileData.bank || '',
                cuil: profileData.cuil || '',
                phone: profileData.phone || '',
                isPublicOfficial: profileData.isPublicOfficial || false,
                officialId: profileData.officialId || '',
                hasCriminalRecord: profileData.hasCriminalRecord || false,
                categories: profileData.categories?.length ? profileData.categories : (profileData.services || []),
                photoURL: profileData.photoURL || user?.photoURL || '',
                dniFrontURL: profileData.dniFrontURL || '',
                dniBackURL: profileData.dniBackURL || ''
            });
            setInitialLoad(false);
        }
    }, [profileData, initialLoad, user]);

    const captureProfilePhoto = async () => {
        try {
            const image = await CapacitorCamera.getPhoto({
                quality: 60,
                width: 800,
                height: 800,
                allowEditing: false,
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Camera
            });
            if (image.dataUrl) {
                setFormData(prev => ({ ...prev, photoURL: image.dataUrl as string }));
            }
        } catch (err: any) {
            console.error("Camera error:", err);
            if (err.message !== 'User cancelled photos app') {
                toast({ title: "Error de cámara", description: "No se pudo acceder a la cámara o se denegó el permiso.", variant: "destructive" });
            }
        }
    };
    
    const openScanner = (target: 'dniFrontURL' | 'dniBackURL') => {
        setScannerTarget(target);
        setIsScannerOpen(true);
    };

    const handleSave = async () => {
        if (!firestore || !user) return;
        if (!formData.photoURL) {
            toast({ title: "Foto obligatoria", description: "Debes tomar una foto de perfil para la credencial.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            // Upload images to Storage first
            const uploadedPhoto = formData.photoURL ? await uploadImage(formData.photoURL, `users/${user.uid}/profile.jpg`) : '';
            const uploadedDniFront = formData.dniFrontURL ? await uploadImage(formData.dniFrontURL, `users/${user.uid}/dni_front.jpg`) : '';
            const uploadedDniBack = formData.dniBackURL ? await uploadImage(formData.dniBackURL, `users/${user.uid}/dni_back.jpg`) : '';

            // Update state with URLs so UI doesn't break
            setFormData(prev => ({ 
                ...prev, 
                photoURL: uploadedPhoto, 
                dniFrontURL: uploadedDniFront, 
                dniBackURL: uploadedDniBack 
            }));

            // Save URLs instead of base64 to Firestore
            await updateDoc(doc(firestore, 'users', user.uid), {
                ...formData,
                fullName: [formData.firstName, formData.lastName].filter(Boolean).join(' ') || user.displayName || '',
                categories: formData.categories,
                services: formData.categories,
                photoURL: uploadedPhoto,
                dniFrontURL: uploadedDniFront,
                dniBackURL: uploadedDniBack,
                banking: { cbu: formData.cbu, alias: formData.alias, bank: formData.bank, updatedAt: serverTimestamp() },
                isProviderProfileComplete: true,
                updatedAt: serverTimestamp()
            });
            toast({ title: "Datos Guardados", description: "Tu perfil de prestador se actualizó correctamente.", className: "bg-primary text-white rounded-[2rem]" });
        } catch (error) { 
            console.error("Error saving profile", error);
            toast({ title: "Error al guardar", description: "Hubo un problema subiendo los archivos o guardando.", variant: "destructive" }); 
        } finally { 
            setIsSaving(false); 
        }
    };

    if (isUserLoading || isProfileLoading) return <div className="flex justify-center items-center h-screen bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

    return (
        <div className="container max-w-2xl mx-auto py-8 px-6 pb-48 bg-slate-50 min-h-screen font-sans animate-in fade-in duration-500">
            
            {/* CREDENCIAL EN TIEMPO REAL */}
            <div className="mb-8">
                <motion.div className="relative w-full bg-primary rounded-3xl p-6 md:p-8 text-white shadow-xl overflow-hidden border border-white/10">
                    <div className="relative flex items-center gap-4 md:gap-6">
                        <button onClick={captureProfilePhoto} className="w-24 h-24 shrink-0 rounded-full bg-red-700 border-2 border-white/20 overflow-hidden relative group">
                            {formData.photoURL ? <img src={formData.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center gap-1"><Camera className="h-6 w-6 text-white/60" /><p className="text-xs font-bold text-white/60">Foto</p></div>}
                        </button>
                        <div className="flex flex-col justify-center py-2 flex-1 min-w-0">
                            <h2 className="text-xl font-bold tracking-tight truncate">{formData.firstName || 'Nombre'} {formData.lastName || 'Apellido'}</h2>
                            <p className="text-xs font-bold text-white/40 mb-2">DNI: {formData.dni || '00.000.000'}</p>
                            
                            <div className="bg-primary/20 px-3 py-1.5 rounded-lg border border-primary/30 inline-block self-start">
                                <p className="text-[9px] font-bold text-white uppercase tracking-wider">
                                    {profileData?.isProviderProfileComplete ? 'Perfil Verificado' : 'Registro en proceso'}
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            <Tabs defaultValue="legal" className="space-y-8">
                <TabsList className="bg-white/50 backdrop-blur-md rounded-2xl h-14 p-1.5 shadow-sm border border-slate-100 w-full">
                    <TabsTrigger value="info" className="flex-1 rounded-xl font-bold text-xs tracking-tight">Información</TabsTrigger>
                    <TabsTrigger value="legal" className="flex-1 rounded-xl font-bold text-xs tracking-tight">Legal & DDJJ</TabsTrigger>
                    <TabsTrigger value="bancario" className="flex-1 rounded-xl font-bold text-xs tracking-tight">Cobros</TabsTrigger>
                    <TabsTrigger value="rubros" className="flex-1 rounded-xl font-bold text-xs tracking-tight">Rubros</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                    <Card className="rounded-2xl border-none shadow-sm bg-white p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Input placeholder="Nombre" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="h-12 rounded-xl bg-slate-50 border-none font-bold" />
                            <Input placeholder="Apellido" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="h-12 rounded-xl bg-slate-50 border-none font-bold" />
                        </div>
                        <Input placeholder="DNI" value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} className="h-12 rounded-xl bg-slate-50 border-none font-bold" />
                    </Card>

                    <div className="grid grid-cols-2 gap-4">
                        <Card onClick={() => window.location.href='/redeconomix/prestadores/calificaciones'} className="p-6 rounded-2xl bg-white border-slate-100 shadow-sm text-center cursor-pointer hover:bg-slate-50 transition-all active:scale-95 group">
                            <div className="w-12 h-12 rounded-xl bg-red-50 text-primary flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform"><Star className="h-6 w-6 fill-primary" /></div>
                            <p className="text-2xl font-bold text-slate-900">4.9</p>
                            <p className="text-xs font-bold text-slate-400">Reputación</p>
                            <Button variant="link" className="text-[10px] font-bold text-primary p-0 h-auto mt-2">Ver comentarios</Button>
                        </Card>
                        <Card onClick={() => window.location.href='/redeconomix/prestadores/historial'} className="p-6 rounded-2xl bg-white border-slate-100 shadow-sm text-center cursor-pointer hover:bg-slate-50 transition-all active:scale-95 group">
                            <div className="w-12 h-12 rounded-xl bg-red-50 text-primary flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform"><Clock className="h-6 w-6 fill-primary" /></div>
                            <p className="text-2xl font-bold text-slate-900">124</p>
                            <p className="text-xs font-bold text-slate-400">Misiones</p>
                            <Button variant="link" className="text-[10px] font-bold text-primary p-0 h-auto mt-2">Ver historial</Button>
                        </Card>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-slate-50">
                            <div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-slate-400" /><span className="text-sm font-medium text-slate-600">Miembro desde</span></div>
                            <span className="text-sm font-bold text-slate-900">Marzo 2024</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-slate-50">
                            <div className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-primary" /><span className="text-sm font-medium text-slate-600">Estado de perfil</span></div>
                            <span className="text-sm font-bold text-primary">{profileData?.isProviderProfileComplete ? 'Perfil Verificado ✓' : 'Registro en proceso'}</span>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="legal" className="space-y-6">
                    <Card className="rounded-2xl border-none shadow-sm bg-white p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <Button onClick={() => openScanner('dniFrontURL')} variant="outline" className={cn("h-24 rounded-3xl border-dashed border-2 flex flex-col gap-2 relative overflow-hidden", formData.dniFrontURL && "border-primary bg-red-50")}>
                                {formData.dniFrontURL ? (
                                    <>
                                        <img src={formData.dniFrontURL} className="absolute inset-0 w-full h-full object-cover opacity-20" />
                                        <CheckCircle2 className="text-primary relative z-10" />
                                    </>
                                ) : <Camera className="text-slate-300" />}
                                <span className="text-[10px] font-bold relative z-10">DNI frente</span>
                            </Button>
                            <Button onClick={() => openScanner('dniBackURL')} variant="outline" className={cn("h-24 rounded-3xl border-dashed border-2 flex flex-col gap-2 relative overflow-hidden", formData.dniBackURL && "border-primary bg-red-50")}>
                                {formData.dniBackURL ? (
                                    <>
                                        <img src={formData.dniBackURL} className="absolute inset-0 w-full h-full object-cover opacity-20" />
                                        <CheckCircle2 className="text-primary relative z-10" />
                                    </>
                                ) : <Camera className="text-slate-300" />}
                                <span className="text-[10px] font-bold relative z-10">DNI dorso</span>
                            </Button>
                        </div>

                        <Button variant="outline" className="w-full h-16 max-sm:h-12 rounded-2xl border-slate-100 flex items-center justify-between px-6">
                            <div className="flex items-center gap-3"><FileText className="h-5 w-5 text-primary" /><span className="text-sm font-bold">Adjuntar CV (PDF)</span></div>
                            <FilePlus className="h-4 w-4 text-slate-300" />
                        </Button>
                    </Card>

                    <Card className="rounded-[2.5rem] border-none shadow-sm bg-rose-50 p-8 space-y-4 border border-rose-100">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-rose-600">Certificado de antecedentes</h3>
                            <Switch checked={formData.hasCriminalRecord} onCheckedChange={val => setFormData({...formData, hasCriminalRecord: val})} />
                        </div>
                        <p className="text-xs font-medium text-rose-400 leading-relaxed">Tenés 60 días para adjuntar el PDF del certificado emitido por el RNR.</p>
                    </Card>
                </TabsContent>

                <TabsContent value="bancario">
                    <Card className="rounded-[2.5rem] bg-white p-8 space-y-5 shadow-sm">
                        <div className="space-y-4">
                            <Input placeholder="CBU / CVU" value={formData.cbu} onChange={e => setFormData({...formData, cbu: e.target.value})} className="h-14 rounded-2xl bg-slate-50 border-none font-bold" />
                            <Input placeholder="Alias de cuenta" value={formData.alias} onChange={e => setFormData({...formData, alias: e.target.value})} className="h-14 rounded-2xl bg-slate-50 border-none font-bold" />
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="rubros">
                    <Card className="rounded-[2.5rem] bg-white p-8 shadow-sm grid grid-cols-1 gap-2">
                        {['Transporte', 'Salud', 'Hogar', 'Tecnología'].map(cat => (
                            <button key={cat} onClick={() => setFormData(prev => ({ ...prev, categories: prev.categories.includes(cat) ? prev.categories.filter(c => c !== cat) : [...prev.categories, cat] }))} className={cn("p-4 rounded-2xl border transition-all text-left font-bold text-sm", formData.categories.includes(cat) ? "bg-primary text-white border-primary" : "bg-slate-50 border-transparent text-slate-500")}>
                                {cat}
                            </button>
                        ))}
                    </Card>
                </TabsContent>
            </Tabs>

            <div className="mt-8 mb-24">
                <Button onClick={handleSave} disabled={isSaving} className="w-full h-14 rounded-xl bg-primary hover:bg-red-700 text-white font-bold text-sm shadow-xl active:scale-95">
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save className="h-5 w-5 mr-2" />} Guardar Datos
                </Button>
            </div>
            
            <DNICamera 
                isOpen={isScannerOpen} 
                onClose={() => setIsScannerOpen(false)} 
                title={scannerTarget === 'dniFrontURL' ? "Escanea el FRENTE de tu DNI" : "Escanea el DORSO de tu DNI"}
                onCapture={(imageSrc) => {
                    if (scannerTarget) {
                        setFormData(prev => ({ ...prev, [scannerTarget]: imageSrc }));
                    }
                }} 
            />
        </div>
    );
}
