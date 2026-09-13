import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InviteAcceptPage } from '@/components/auth/invite-accept-page';

export const metadata: Metadata = {
  title: 'Undangan tim',
  description: 'Terima undangan workspace Ora Repot.',
  robots: { index: false, follow: false },
};

export default function InvitePage() {
  return (
    <Suspense fallback={<main className="reg-flow-page">Memuat…</main>}>
      <InviteAcceptPage />
    </Suspense>
  );
}
