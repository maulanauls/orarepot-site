import type { Metadata } from 'next';
import { PricingPage } from '@/components/pricing/pricing-page';

export const metadata: Metadata = {
  title: 'Harga Paket Ora Repot',
  description:
    'Bandingkan paket OTP, Broadcast, dan Full Ora Repot. Official WABA Meta untuk broadcast dan OTP WhatsApp bisnis.',
  openGraph: {
    title: 'Harga Paket Ora Repot | ORAREPOT',
    description:
      'Bandingkan paket OTP, Broadcast, dan Full Ora Repot. Official WABA Meta untuk broadcast dan OTP WhatsApp bisnis.',
  },
};

export default function Page() {
  return <PricingPage />;
}
