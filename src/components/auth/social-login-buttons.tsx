'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { GoogleIcon, DiscordIcon } from '@/components/icons/social-icons';
import { Apple } from 'lucide-react';

type Provider = 'google' | 'apple' | 'discord';

export function SocialLoginButtons() {
  const t = useTranslations('auth');
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  async function signInWithProvider(provider: Provider) {
    setLoadingProvider(provider);
    
    const supabase = createClient();
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        ...(provider === 'discord' && {
          scopes: 'identify email',
        }),
      },
    });

    if (error) {
      console.error('OAuth error:', error);
      setLoadingProvider(null);
    }
    // If successful, user will be redirected - no need to reset loading
  }

  const isLoading = (provider: Provider) => loadingProvider === provider;
  const anyLoading = loadingProvider !== null;

  return (
    <div className="space-y-3">
      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            {t('orContinueWith')}
          </span>
        </div>
      </div>

      {/* Social buttons */}
      <div className="grid gap-2">
        {/* Google */}
        <Button
          variant="outline"
          type="button"
          onClick={() => signInWithProvider('google')}
          disabled={anyLoading}
          className="w-full bg-white text-black hover:bg-gray-100 border-gray-300"
        >
          {isLoading('google') ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon className="mr-2 h-4 w-4" />
          )}
          {t('continueWithGoogle')}
        </Button>

        {/* Apple - DISABLED: Provider not configured yet */}
        {/* <Button
          variant="outline"
          type="button"
          onClick={() => signInWithProvider('apple')}
          disabled={anyLoading}
          className="w-full bg-black text-white hover:bg-gray-900 border-black"
        >
          {isLoading('apple') ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Apple className="mr-2 h-4 w-4" />
          )}
          {t('continueWithApple')}
        </Button> */}

        {/* Discord */}
        <Button
          variant="outline"
          type="button"
          onClick={() => signInWithProvider('discord')}
          disabled={anyLoading}
          className="w-full bg-[#5865F2] text-white hover:bg-[#4752C4] border-[#5865F2]"
        >
          {isLoading('discord') ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <DiscordIcon className="mr-2 h-4 w-4" />
          )}
          {t('continueWithDiscord')}
        </Button>
      </div>
    </div>
  );
}

