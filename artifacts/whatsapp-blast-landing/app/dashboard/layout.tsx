import { MetronicAppLayout } from '@/components/layouts/metronic-app-layout';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MetronicAppLayout>{children}</MetronicAppLayout>;
}
