import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/di/orarepot/:slug', destination: '/:slug', permanent: true },
    ];
  },
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  assetPrefix: process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || undefined,
};

export default nextConfig;
