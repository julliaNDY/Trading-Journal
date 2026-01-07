import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // Default locale is English
  const locale = 'en';

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
