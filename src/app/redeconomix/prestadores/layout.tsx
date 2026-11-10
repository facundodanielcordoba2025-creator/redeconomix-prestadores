'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, useUser, useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Loader2, User, LogOut } from "lucide-react";
import { PrestadorBottomNav } from '@/components/prestador-bottom-nav';
import { NotificationsBell } from '@/components/notifications-bell';

const FullScreenLoader = () => (
    <div className="flex h-screen w-full items-center justify-center bg-white">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
);

export default function PrestadorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const { data: profileData } = useDoc<any>(
    user && firestore ? doc(firestore, 'users', user.uid) : null
  );

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login'); // Or a specific provider login page
    }
  }, [isUserLoading, user, router]);

  const handleLogout = async () => {
    if (auth) {
        await signOut(auth);
        router.push('/login');
    }
  };

  if (isUserLoading || !user) {
    return <FullScreenLoader />;
  }

  const displayName = profileData?.firstName 
    ? `${profileData.firstName} ${profileData.lastName || ''}`.trim() 
    : (user?.displayName || user?.email || 'Prestador');

  const initial = displayName.charAt(0).toUpperCase();

  const avatarUrl = profileData?.photoURL || user?.photoURL;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 flex h-16 sm:h-20 items-center justify-between gap-4 border-b border-primary/20 bg-primary px-4 md:px-6 shadow-sm">
        <Link href="/redeconomix/prestadores/panel" className="text-xl sm:text-2xl font-black tracking-tight text-white">
            PANEL PRESTADOR
        </Link>
        <div className="flex items-center gap-3">
            <div className="text-white [&_svg]:text-white [&_button]:bg-red-500 hover:[&_button]:bg-red-400 [&_button]:border-transparent">
                <NotificationsBell />
            </div>
            <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-200">Prestador Verificado</span>
                <span className="text-xs font-bold text-white ">{displayName}</span>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 sm:h-12 sm:w-12 rounded-full ring-2 ring-red-400 hover:ring-white transition-all overflow-hidden bg-white shadow-sm p-0 flex items-center justify-center">
                      <Avatar className="h-full w-full bg-white flex items-center justify-center">
                          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />}
                          <AvatarFallback className="bg-slate-100 text-slate-800 font-black text-sm sm:text-base uppercase flex items-center justify-center w-full h-full m-0">
                              {initial || <User className="w-5 h-5 text-slate-600" />}
                          </AvatarFallback>
                      </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 mt-2 p-4 rounded-[2rem] bg-white text-slate-900 border-slate-100 shadow-2xl z-[5000]">
                    <DropdownMenuLabel className="font-bold  uppercase text-xs tracking-widest text-slate-400 mb-2">Mi Gestión</DropdownMenuLabel>
                    <DropdownMenuItem className="rounded-xl h-12 mb-1 cursor-pointer flex items-center px-4 hover:bg-slate-50 transition-colors" onSelect={() => router.push('/redeconomix/prestadores/perfil')}>
                      <User className="mr-3 h-5 w-5 text-primary" /> 
                      <span className="font-bold text-slate-700 text-sm">Mi Perfil</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-slate-100 my-2" />
                    <DropdownMenuItem onClick={handleLogout} className="rounded-xl h-12 text-primary focus:bg-red-50 focus:text-red-500 cursor-pointer flex items-center px-4 transition-colors">
                        <LogOut className="mr-3 h-5 w-5" />
                        <span className="font-bold text-sm">Cerrar Sesión</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </header>
      <div className="w-full pb-24 md:pb-8">
        {children}
      </div>
      <PrestadorBottomNav />
    </div>
  );
}
