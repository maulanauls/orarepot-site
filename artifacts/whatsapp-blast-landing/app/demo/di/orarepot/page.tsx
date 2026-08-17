import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DemoPage } from '@/components/demo/demo-page';

export const metadata: Metadata = {
  title: 'Demo Produk',
  description:
    'Coba layanan Ora Repot: kirim OTP demo atau chat langsung ke WhatsApp bot AI.',
  openGraph: {
    title: 'Demo Produk | ORAREPOT',
    description:
      'Coba layanan Ora Repot: kirim OTP demo atau chat langsung ke WhatsApp bot AI.',
  },
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="demo-page">
          <div className="container" style={{ padding: '80px 0' }}>
            Memuat form demo…
          </div>
        </main>
      }
    >
      <DemoPage />
    </Suspense>
  );
}
