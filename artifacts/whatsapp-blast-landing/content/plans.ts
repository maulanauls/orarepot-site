export type PlanId = 'otp' | 'broadcast' | 'full';

export type Plan = {
  id: PlanId;
  name: string;
  price: number;
  priceLabel: string;
  period: string;
  desc: string;
  features: string[];
  popular?: boolean;
};

export const SUBSCRIPTION_PLANS: Plan[] = [
  {
    id: 'otp',
    name: 'OTP',
    price: 50000,
    priceLabel: '50.000',
    period: 'Per akun / bulan',
    desc: 'Kirim & verifikasi OTP WhatsApp resmi untuk login, register, dan reset password.',
    features: [
      'OTP WhatsApp resmi (WABA)',
      'Rp 600 / pesan OTP (deposit Rp 50.000)',
      'Dashboard OTP & logs',
      'Template pesan OTP',
      'Rate limit & keamanan dasar',
    ],
  },
  {
    id: 'broadcast',
    name: 'Broadcast',
    price: 150000,
    priceLabel: '150.000',
    period: 'Per akun / bulan',
    desc: 'Broadcast kampanye WhatsApp untuk merchant yang butuh jangkauan luas.',
    popular: true,
    features: [
      'Broadcast kampanye WABA',
      'Laporan terkirim & terbaca',
      'Multi-kampanye',
      'Onboarding dibantu tim',
    ],
  },
  {
    id: 'full',
    name: 'Full',
    price: 175000,
    priceLabel: '175.000',
    period: 'Per akun / bulan',
    desc: 'OTP + Broadcast dalam satu langganan — lengkap untuk operasional merchant.',
    features: [
      'Semua fitur OTP',
      'Semua fitur Broadcast',
      'Prioritas support',
      'Integrasi aplikasi',
    ],
  },
];

export function getPlan(id: string | null | undefined) {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id) ?? SUBSCRIPTION_PLANS[0];
}

export function formatIdr(amount: number) {
  return new Intl.NumberFormat('id-ID').format(amount);
}
