import type { Metadata } from 'next';
import { MetronicAppLayout } from '@/components/layouts/metronic-app-layout';
import { DashboardGate } from '@/components/dashboard/dashboard-gate';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardGate>
      <MetronicAppLayout>{children}</MetronicAppLayout>
    </DashboardGate>
  );
}
