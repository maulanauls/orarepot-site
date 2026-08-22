import { OtpTemplateDetailPage } from '@/components/dashboard/otp-template-detail';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OtpTemplateDetailPage id={id} />;
}
