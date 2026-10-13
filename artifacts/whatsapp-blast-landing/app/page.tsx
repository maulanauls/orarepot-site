import { HomePage } from '@/components/home/home-page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'WhatsApp OTP API dan Broadcast Bisnis',
  description:
    'Kirim OTP dan broadcast lewat WhatsApp Business API resmi Meta. Ora Repot juga menyediakan AI assistant untuk chat pelanggan, plus pulsa dan voucher digital.',
  path: '/',
});

export default function Page() {
  return <HomePage />;
}
