import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ORAREPOT',
    template: '%s | ORAREPOT',
  },
  description:
    'Ora Repot menyatukan Agentic AI customer relationship, broadcast & OTP resmi WhatsApp (WABA), serta pembelian pulsa dan voucher digital.',
  metadataBase: new URL('http://localhost:5173'),
  openGraph: {
    title: 'ORAREPOT',
    description: 'AI Assistant, WABA messaging, dan digital goods dalam satu platform.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ORAREPOT',
    description: 'AI Assistant, WABA messaging, dan digital goods dalam satu platform.',
  },
  icons: {
    icon: '/logo-orarepot-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="antialiased">
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
