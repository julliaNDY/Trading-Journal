'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { AuthLanguageSwitcher } from '@/components/layout/auth-language-switcher';
import { createAccountFromStripe } from '@/app/actions/auth';

export function CreateAccountContent() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      setError('Missing session ID. Please complete the checkout process.');
      setStatus('error');
      return;
    }

    // Create account and send password creation email
    createAccountFromStripe(sessionId).then((result) => {
      if (result.success) {
        setEmail(result.email || null);
        setStatus('success');
      } else {
        setError(result.error || 'Failed to create account. Please contact support.');
        setStatus('error');
      }
    }).catch((err) => {
      setError('An unexpected error occurred. Please contact support.');
      setStatus('error');
    });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-radial bg-grid-pattern p-4">
      <div className="absolute inset-0 bg-background/80" />
      
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-20">
        <AuthLanguageSwitcher />
      </div>
      
      <Card className="w-full max-w-md relative z-10 animate-scale-in">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">
            {t('createAccount') || 'Create Your Account'}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && (t('creatingAccount') || 'Setting up your account...')}
            {status === 'success' && (t('accountCreated') || 'Account created successfully!')}
            {status === 'error' && (t('accountCreationError') || 'Error creating account')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground text-center">
                {t('processing') || 'Processing your subscription...'}
              </p>
            </div>
          )}

          {status === 'success' && email && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <Mail className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <p className="font-semibold mb-2">
                  {t('emailSent') || 'Check your email!'}
                </p>
                <p className="text-sm">
                  {t('passwordCreationEmailSent', { email }) || 
                    `We have sent a password creation link to ${email}. Please check your inbox and click the link to set your password.`}
                </p>
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {status === 'success' && (
            <div className="space-y-2 text-sm text-muted-foreground text-center">
              <p>
                {t('emailInstructions') || "Once you've set your password, you can log in to access your dashboard."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
