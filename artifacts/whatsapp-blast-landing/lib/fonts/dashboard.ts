import { Poppins } from 'next/font/google';

/** Shared Poppins instance for dashboard shell + portaled overlays */
export const dashboardPoppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});
