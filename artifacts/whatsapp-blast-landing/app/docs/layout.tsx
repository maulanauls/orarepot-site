import type { Metadata } from 'next';
import { MetronicAppLayout } from '@/components/layouts/metronic-app-layout';

export const metadata: Metadata = {
  title: {
    default: 'Docs',
    template: '%s | Ora Repot Docs',
  },
  description: 'OTP WhatsApp API — api.orarepot.com',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <MetronicAppLayout>{children}</MetronicAppLayout>;
}
