import type { Metadata } from 'next';
import { MetronicAppLayout } from '@/components/layouts/metronic-app-layout';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MetronicAppLayout>{children}</MetronicAppLayout>;
}
