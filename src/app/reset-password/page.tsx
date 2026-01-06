'use client';

import { useState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { AuthLanguageSwitcher } from '@/components/layout/auth-language-switcher';
import { updatePassword } from '@/app/actions/auth';
import { createBrowserClient } from '@supabase/ssr';

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('auth');

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('resetPassword')}...
        </>
      ) : (
        t('resetPassword')
      )}
    </Button>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  // Gérer l'authentification au chargement (hash fragments, code PKCE, ou session existante)
  useEffect(() => {
    const handleAuth = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // 1. Vérifier les hash fragments (implicit flow) - ex: #access_token=xxx&type=recovery
      if (typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        const errorParam = hashParams.get('error');
        const errorDesc = hashParams.get('error_description');

        console.log('[ResetPassword] Hash params detected:', { type, hasToken: !!accessToken, error: errorParam });

        if (errorParam) {
          console.error('[ResetPassword] Error in hash:', errorParam, errorDesc);
          setError(errorDesc || t('sessionExpired') || 'Session expired. Please request a new reset link.');
          setIsValidSession(false);
          return;
        }

        if (accessToken && type === 'recovery') {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (error) {
            console.error('[ResetPassword] Error setting session from hash:', error);
            setError(t('sessionExpired') || 'Session expired. Please request a new reset link.');
            setIsValidSession(false);
            return;
          }

          // Session établie - nettoyer le hash de l'URL
          window.history.replaceState(null, '', window.location.pathname);
          setIsValidSession(true);
          return;
        }
      }

      // 2. Vérifier le code PKCE dans l'URL (fallback si le callback n'a pas fonctionné)
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
          console.log('[ResetPassword] PKCE code detected, exchanging...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error('[ResetPassword] Error exchanging code:', error);
            setError(t('sessionExpired') || 'Session expired. Please request a new reset link.');
            setIsValidSession(false);
            return;
          }

          if (data?.session) {
            // Nettoyer l'URL
            window.history.replaceState(null, '', window.location.pathname);
            setIsValidSession(true);
            return;
          }
        }
      }

      // 3. Vérifier si on a déjà une session valide (via cookies)
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[ResetPassword] Existing session check:', !!session);
      
      if (session) {
        setIsValidSession(true);
      } else {
        // Pas de session - afficher erreur
        setError(t('sessionExpired') || 'Session expired. Please request a new reset link.');
        setIsValidSession(false);
      }
    };

    handleAuth();
  }, [t]);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    
    if (password.length < 8) {
      setError(t('passwordTooShort') || 'Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordMismatch') || 'Les mots de passe ne correspondent pas');
      return;
    }

    const result = await updatePassword(password);
    
    if (result.success) {
      setSuccess(true);
      // Rediriger vers le dashboard après 2 secondes
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } else {
      setError(result.error || 'Une erreur est survenue');
    }
  }

  // Loading state pendant la vérification de session
  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-radial bg-grid-pattern p-4">
        <div className="absolute inset-0 bg-background/80" />
        <Card className="w-full max-w-md relative z-10">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Session invalide - afficher erreur avec lien
  if (isValidSession === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-radial bg-grid-pattern p-4">
        <div className="absolute inset-0 bg-background/80" />
        <div className="absolute top-4 right-4 z-20">
          <AuthLanguageSwitcher />
        </div>
        <Card className="w-full max-w-md relative z-10">
          <CardHeader className="space-y-4 text-center">
            <CardTitle className="text-2xl font-bold">{t('resetPasswordTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
              {error || t('sessionExpired') || 'Session expired. Please request a new reset link.'}
            </div>
            <Link href="/forgot-password">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('requestNewLink') || 'Request a new link'}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
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
            <CardTitle className="text-2xl font-bold">{t('resetPasswordTitle')}</CardTitle>
            <CardDescription>
              {t('resetPasswordDescription')}
            </CardDescription>
          </div>
        </CardHeader>

        {success ? (
          <CardContent className="space-y-4">
            <div className="p-4 text-sm text-success bg-success/10 rounded-lg animate-fade-in flex items-start gap-3">
              <CheckCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <span>{t('passwordResetSuccess') || 'Mot de passe mis à jour avec succès!'}</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {t('redirectingToDashboard') || 'Redirection vers le tableau de bord...'}
            </p>
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
                <Label htmlFor="password">{t('newPassword')}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">{t('passwordMinLength')}</p>
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
              <Link href="/login" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" />
                {t('backToLogin')}
              </Link>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
