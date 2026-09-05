import { MetronicAppLayout } from '@/components/layouts/metronic-app-layout';
import { DashboardGate } from '@/components/dashboard/dashboard-gate';

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
