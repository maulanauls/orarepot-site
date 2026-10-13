import { PricingPage } from '@/components/pricing/pricing-page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Harga WhatsApp OTP API dan Broadcast',
  description:
    'Bandingkan paket OTP, broadcast, dan lengkap Ora Repot. Harga untuk WhatsApp Business API resmi: kirim kode verifikasi dan kampanye.',
  path: '/harga/di/orarepot',
});

export default function Page() {
  return <PricingPage />;
}
