import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // ESLINT OFF
  eslint: {
    ignoreDuringBuilds: true,
  },

  // TYPESCRIPT OFF
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withNextIntl(nextConfig);
