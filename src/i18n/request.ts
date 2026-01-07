import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

export const locales = ['fr', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fr'; // FR par défaut selon les specs

/**
 * Détecte la langue préférée du navigateur depuis l'en-tête Accept-Language
 */
function detectBrowserLanguage(acceptLanguage: string | null): Locale | null {
  if (!acceptLanguage) return null;
  
  // Parse Accept-Language header (ex: "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7")
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [code, qValue] = lang.trim().split(';q=');
      return {
        code: code.split('-')[0].toLowerCase(), // Prendre seulement le code langue (fr-FR -> fr)
        quality: qValue ? parseFloat(qValue) : 1.0,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  // Trouver la première langue supportée
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
  
  // 1. Priorité au cookie (choix explicite de l'utilisateur)
  const localeCookie = cookieStore.get('locale')?.value;
  if (localeCookie && locales.includes(localeCookie as Locale)) {
    return {
      locale: localeCookie as Locale,
      messages: (await import(`../../messages/${localeCookie}.json`)).default,
    };
  }
  
  // 2. Détection via Accept-Language header (première visite)
  const acceptLanguage = headerStore.get('accept-language');
  const browserLocale = detectBrowserLanguage(acceptLanguage);
  if (browserLocale) {
    return {
      locale: browserLocale,
      messages: (await import(`../../messages/${browserLocale}.json`)).default,
    };
  }
  
  // 3. Fallback sur FR (langue par défaut)
  return {
    locale: defaultLocale,
    messages: (await import(`../../messages/${defaultLocale}.json`)).default,
  };
});






