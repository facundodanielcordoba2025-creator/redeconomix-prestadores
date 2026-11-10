'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function RootPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    if (isUserLoading) return;
    
    if (!user) {
      router.replace('/login');
      return;
    }

    async function checkRoleAndRoute() {
      if (!firestore || !user?.email) {
        router.replace('/redeconomix/prestadores/panel');
        return;
      }

      try {
        const q = query(
          collection(firestore, 'retailer_employees'),
          where('email', '==', user.email.toLowerCase().trim()),
          where('status', '==', 'active')
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const empDoc = snap.docs[0].data();
          const role = empDoc.role || 'cashier';
          if (typeof window !== 'undefined') {
            localStorage.setItem('rex_role', role);
            localStorage.setItem('rex_session_active', '1');
            localStorage.setItem('rex_employee_session', JSON.stringify({
              id: empDoc.id || snap.docs[0].id,
              name: empDoc.name,
              dni: empDoc.dni,
              role: role,
              branchId: empDoc.branchId,
              retailerId: empDoc.retailerId
            }));
          }
          if (role === 'cashier' || role === 'cashier_warehouse') {
            router.replace('/redeconomix/dashboard-negocio/control-ventas');
            return;
          }
        }
      } catch (e) {
        console.error("Error identificando rol en inicio:", e);
      }

      router.replace('/redeconomix/prestadores/panel');
    }

    checkRoleAndRoute();
  }, [user, isUserLoading, firestore, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#D60000] border-r-transparent align-[-0.125em]" role="status" />
        <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-400">
          Iniciando RedEconomiX Prestadores...
        </p>
      </div>
    </div>
  );
}
