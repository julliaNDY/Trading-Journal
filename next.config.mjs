import createNextIntlPlugin from 'next-intl/plugin';
import bundleAnalyzer from '@next/bundle-analyzer';

// Explicitly specify path to i18n config
const withNextIntl = createNextIntlPlugin('./i18n.ts');

// Bundle analyzer (run with ANALYZE=true npm run build)
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

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

  // ESLint et TypeScript vérifiés pendant le build
  // (Corrections appliquées le 2026-01-10 par Quinn QA)
};

export default withBundleAnalyzer(withNextIntl(nextConfig));
