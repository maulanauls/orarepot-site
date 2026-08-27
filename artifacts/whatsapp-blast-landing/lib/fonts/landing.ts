import { Plus_Jakarta_Sans } from 'next/font/google';

/** Marketing / landing typeface — dashboard stays on Poppins. */
export const landingJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});
