import { CheckoutPage } from '@/components/pay/checkout-page';

export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <CheckoutPage sessionId={sessionId} />;
}
