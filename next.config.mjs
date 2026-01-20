import createNextIntlPlugin from 'next-intl/plugin';
import bundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';

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
    // Required for instrumentation.ts
    instrumentationHook: true,
  },

  // ESLint et TypeScript vérifiés pendant le build
  // (Corrections appliquées le 2026-01-10 par Quinn QA)
};

// Sentry configuration for source maps and release tracking
const sentryWebpackPluginOptions = {
  // Organization and project from Sentry dashboard
  org: process.env.SENTRY_ORG || 'trading-path',
  project: process.env.SENTRY_PROJECT || 'trading-journal',

  // Auth token for source map uploads (CI/CD only)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only upload source maps in production builds
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps for better stack traces
  widenClientFileUpload: true,

  // Automatically instrument React components
  reactComponentAnnotation: {
    enabled: true,
  },

  // Route browser requests to Sentry through Next.js rewrites
  tunnelRoute: '/monitoring-tunnel',

  // Disable Sentry telemetry
  telemetry: false,

  // Hide source maps from end users
  hideSourceMaps: true,

  // Disable logger in production
  disableLogger: true,
};

// Chain: Sentry -> BundleAnalyzer -> NextIntl -> Base Config
export default withSentryConfig(
  withBundleAnalyzer(withNextIntl(nextConfig)),
  sentryWebpackPluginOptions
);
