'use client';

import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { register } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle } from 'lucide-react';
import { AuthLanguageSwitcher } from '@/components/layout/auth-language-switcher';

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('auth');

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('register')}...
        </>
      ) : (
        t('register')
      )}
    </Button>
  );
}

export default function RegisterPage() {
  const t = useTranslations('auth');
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setShowConfirmation(false);
    const result = await register(formData);
    if (result?.error) {
      setError(result.error);
    } else if (result?.success && result?.needsEmailConfirmation) {
      setShowConfirmation(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-radial bg-grid-pattern p-4">
      <div className="absolute inset-0 bg-background/80" />
      
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-20">
        <AuthLanguageSwitcher />
      </div>
      
      <Card className="w-full max-w-md relative z-10 animate-scale-in">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 animate-fade-in overflow-hidden">
              <Image
                src="/cttp-logo.png"
                alt="CTTP Logo"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold">{t('createAccount')}</CardTitle>
            <CardDescription>
              {t('registerDescription')}
            </CardDescription>
          </div>
        </CardHeader>

        {showConfirmation ? (
          <CardContent className="space-y-4">
            <div className="p-4 text-sm text-success bg-success/10 rounded-lg animate-fade-in flex items-start gap-3">
              <CheckCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <span>{t('checkEmailConfirmation')}</span>
            </div>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                {t('backToLogin')}
              </Button>
            </Link>
          </CardContent>
        ) : (
          <form action={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg animate-fade-in">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t('emailPlaceholder')}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discordUsername">{t('discordUsername')}</Label>
              <Input
                id="discordUsername"
                name="discordUsername"
                type="text"
                placeholder={t('discordUsernamePlaceholder')}
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                autoComplete="new-password"
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                {t('passwordMinLength')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <SubmitButton />
            <p className="text-sm text-muted-foreground text-center">
              {t('hasAccount')}{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                {t('login')}
              </Link>
            </p>
          </CardFooter>
        </form>
        )}
      </Card>
    </div>
  );
}






