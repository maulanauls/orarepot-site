'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/session';

export function DashboardGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/sign-in');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;
  return children;
}
