import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // Simple default locale - middleware handles detection
  const locale = 'fr';

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
