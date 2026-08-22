import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RegisterPageClient } from '@/components/auth/register-page-client';

export const metadata: Metadata = {
  title: 'Daftar',
  description: 'Daftar Ora Repot dan mulai free trial dashboard.',
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="reg-flow-page">Memuat…</main>}>
      <RegisterPageClient />
    </Suspense>
  );
}
