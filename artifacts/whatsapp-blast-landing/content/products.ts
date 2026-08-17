import { Bot, Radio, Ticket, type LucideIcon } from 'lucide-react';

export type ProductSlug =
  | 'agentic-ai'
  | 'waba-messaging'
  | 'pulsa-dan-voucher-game';

export type Product = {
  slug: ProductSlug;
  href: `/di/orarepot/${ProductSlug}`;
  label: string;
  shortTitle: string;
  title: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  icon: LucideIcon;
  highlights: string[];
  benefits: { title: string; body: string }[];
  cta: string;
};

export const products: Product[] = [
  {
    slug: 'agentic-ai',
    href: '/di/orarepot/agentic-ai',
    label: 'Agentic AI',
    shortTitle: 'AI Assistant',
    title: 'AI Assistant untuk customer relationship merchant WhatsApp',
    description:
      'Bantu merchant WhatsApp melayani pelanggan, jawab pertanyaan, dan jaga hubungan secara otomatis — tetap terasa manusiawi.',
    seoTitle: 'Agentic AI Customer Relationship | ORAREPOT',
    seoDescription:
      'AI Assistant Ora Repot membantu merchant WhatsApp menjaga customer relationship, balas chat, dan follow-up otomatis.',
    icon: Bot,
    highlights: [
      'Balas chat pelanggan lebih cepat',
      'Follow-up otomatis yang tetap ramah',
      'Eskalasi ke manusia saat dibutuhkan',
    ],
    benefits: [
      {
        title: 'Siap jaga toko saat sibuk',
        body: 'AI menangani pertanyaan berulang tentang stok, harga, dan status order agar tim fokus closing.',
      },
      {
        title: 'Customer relationship yang konsisten',
        body: 'Nada balasan tetap hangat dan sesuai brand, dari first reply sampai after-sales.',
      },
      {
        title: 'Bekerja di WhatsApp',
        body: 'Pelanggan tidak perlu app baru — percakapan tetap di jalur yang sudah mereka pakai.',
      },
    ],
    cta: 'Coba sekarang',
  },
  {
    slug: 'waba-messaging',
    href: '/di/orarepot/waba-messaging',
    label: 'WABA Messaging',
    shortTitle: 'Broadcast & OTP',
    title: 'Broadcast & OTP resmi lewat WhatsApp Business API',
    description:
      'Kirim kampanye dan kode verifikasi lewat Official WABA Meta. Lebih aman, lebih profesional, risiko banned lebih rendah.',
    seoTitle: 'WABA Messaging Broadcast & OTP | ORAREPOT',
    seoDescription:
      'Layanan broadcast WhatsApp dan OTP resmi Meta untuk bisnis Indonesia. Official WABA, dashboard, dan setup dibantu tim Ora Repot.',
    icon: Radio,
    highlights: [
      'Official WABA Meta',
      'Broadcast kampanye terukur',
      'OTP verifikasi jalur resmi',
    ],
    benefits: [
      {
        title: 'Broadcast yang lebih aman',
        body: 'Jalur resmi WhatsApp Business API menurunkan risiko banned dibanding sistem tidak resmi.',
      },
      {
        title: 'OTP yang membangun kepercayaan',
        body: 'Kode verifikasi sampai langsung di WhatsApp pelanggan untuk login dan transaksi.',
      },
      {
        title: 'Dashboard kampanye',
        body: 'Pantau terkirim, terbaca, dan hasil OTP dari satu tempat yang mudah dipakai tim.',
      },
    ],
    cta: 'Lihat paket messaging',
  },
  {
    slug: 'pulsa-dan-voucher-game',
    href: '/di/orarepot/pulsa-dan-voucher-game',
    label: 'Digital Goods',
    shortTitle: 'Pulsa & Voucher',
    title: 'Pulsa, voucher game, dan produk digital lainnya',
    description:
      'Satu tempat untuk kebutuhan digital sehari-hari: isi pulsa, beli voucher game, dan produk digital lain tanpa ribet.',
    seoTitle: 'Pulsa dan Voucher Game | ORAREPOT',
    seoDescription:
      'Beli pulsa, paket data, voucher game, dan produk digital lainnya di Ora Repot — cepat dan sederhana.',
    icon: Ticket,
    highlights: [
      'Pulsa & paket data',
      'Voucher game favorit',
      'Checkout sederhana',
    ],
    benefits: [
      {
        title: 'Transaksi digital yang cepat',
        body: 'Isi pulsa dan beli voucher tanpa proses bertele-tele.',
      },
      {
        title: 'Pilihan produk lengkap',
        body: 'Dari kebutuhan harian hingga top-up game dalam satu ekosistem Ora Repot.',
      },
      {
        title: 'Satu brand, banyak solusi',
        body: 'Gabungan SaaS merchant dan digital goods memudahkan pelanggan menemukan apa yang dibutuhkan.',
      },
    ],
    cta: 'Beli produk digital',
  },
];

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}
