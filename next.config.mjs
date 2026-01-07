import createNextIntlPlugin from 'next-intl/plugin';

// Use default path: i18n.ts at project root
const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: 'standalone' mode requires special deployment setup
  // Use 'npm start' for traditional deployment with PM2
  // output: 'standalone',

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
