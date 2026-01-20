/**
 * Lighthouse CI Configuration
 * Story 1.9: Production Monitoring & Alerting
 *
 * Run with: npx lhci autorun
 * In CI: npx lhci autorun --upload.target=temporary-public-storage
 */

module.exports = {
  ci: {
    collect: {
      // URLs to test
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/login',
      ],
      // Number of runs per URL
      numberOfRuns: 3,
      // Start the server before running tests
      startServerCommand: 'npm run start',
      // Settings for each Lighthouse run
      settings: {
        // Chrome flags
        chromeFlags: '--no-sandbox --headless',
        // Throttling preset
        throttlingMethod: 'devtools',
        // Categories to test
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      // Performance budgets (Core Web Vitals)
      assertions: {
        // Performance score
        'categories:performance': ['warn', { minScore: 0.8 }],
        // Accessibility score
        'categories:accessibility': ['error', { minScore: 0.9 }],
        // Best practices score
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        // SEO score
        'categories:seo': ['warn', { minScore: 0.8 }],

        // Core Web Vitals
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }], // 2s
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }], // 2.5s (Good)
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }], // 0.1 (Good)
        'total-blocking-time': ['warn', { maxNumericValue: 200 }], // 200ms
        'interactive': ['warn', { maxNumericValue: 3800 }], // 3.8s (Good TTI)

        // Resource budgets
        'resource-summary:script:size': ['warn', { maxNumericValue: 500000 }], // 500KB JS
        'resource-summary:total:size': ['warn', { maxNumericValue: 2000000 }], // 2MB total
      },
    },
    upload: {
      // For local development
      target: 'filesystem',
      outputDir: './.lighthouseci',
      // For CI: use 'lhci' with LHCI server or 'temporary-public-storage'
    },
  },
};
