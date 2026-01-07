import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

// Locale configuration
const locales = ['fr', 'en'] as const;
type Locale = (typeof locales)[number];
const defaultLocale: Locale = 'fr';

function detectBrowserLanguage(acceptLanguage: string | null): Locale | null {
  if (!acceptLanguage) return null;
  
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [code, qValue] = lang.trim().split(';q=');
      return {
        code: code.split('-')[0].toLowerCase(),
        quality: qValue ? parseFloat(qValue) : 1.0,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const lang of languages) {
    if (locales.includes(lang.code as Locale)) {
      return lang.code as Locale;
    }
  }
  
  return null;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  
  // 1. Cookie priority (explicit user choice)
  const localeCookie = cookieStore.get('locale')?.value;
  if (localeCookie && locales.includes(localeCookie as Locale)) {
    return {
      locale: localeCookie as Locale,
      messages: (await import(`./messages/${localeCookie}.json`)).default,
    };
  }
  
  // 2. Browser language detection
  const acceptLanguage = headerStore.get('accept-language');
  const browserLocale = detectBrowserLanguage(acceptLanguage);
  if (browserLocale) {
    return {
      locale: browserLocale,
      messages: (await import(`./messages/${browserLocale}.json`)).default,
    };
  }
  
  // 3. Fallback to FR
  return {
    locale: defaultLocale,
    messages: (await import(`./messages/${defaultLocale}.json`)).default,
  };
});
