import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';

// Supported locales - English is default
const locales = ['en', 'fr'] as const;
type Locale = (typeof locales)[number];
const defaultLocale: Locale = 'en';

export default getRequestConfig(async () => {
  // Read locale from middleware header
  const headersList = await headers();
  const localeHeader = headersList.get('x-next-intl-locale');
  
  // Validate and use the locale from middleware, fallback to default
  const locale = localeHeader && locales.includes(localeHeader as Locale) 
    ? localeHeader 
    : defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
