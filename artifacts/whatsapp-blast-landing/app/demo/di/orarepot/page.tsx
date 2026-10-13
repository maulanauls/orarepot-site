import { Suspense } from 'react';
import { DemoPage } from '@/components/demo/demo-page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Demo WhatsApp OTP dan AI',
  description:
    'Coba Ora Repot: kirim OTP demo lewat WhatsApp atau chat langsung ke AI assistant.',
  path: '/demo/di/orarepot',
});

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
