import { Suspense } from 'react';
import { PayResultPage } from '@/components/pay/pay-result-page';

export default function Page() {
  return (
    <Suspense>
      <PayResultPage kind="error" />
    </Suspense>
  );
}
