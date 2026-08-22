import { MetronicAppLayout } from '@/components/layouts/metronic-app-layout';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MetronicAppLayout>{children}</MetronicAppLayout>;
}
