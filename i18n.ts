import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';

// Supported locales
export const locales = ['fr', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fr';

export default getRequestConfig(async () => {
  // Get locale from middleware header or use default
  const headersList = await headers();
  const locale = headersList.get('x-next-intl-locale') || defaultLocale;
  
  // Validate locale
  const validLocale = locales.includes(locale as Locale) ? locale : defaultLocale;

  return {
    locale: validLocale,
    messages: (await import(`./messages/${validLocale}.json`)).default,
  };
});
