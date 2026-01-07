'use client';

/**
 * Settings Page Content
 * Epic 10: Gestion de Profil Avancée
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import type { UserIdentity } from '@supabase/supabase-js';
import {
  User,
  Mail,
  MessageCircle,
  Calendar,
  Link as LinkIcon,
  Unlink,
  Loader2,
  AlertTriangle,
  Apple,
  Camera,
  Trash2,
  Key,
  Globe,
  CreditCard,
  Shield,
  LogOut,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { GoogleIcon, DiscordIcon } from '@/components/icons/social-icons';
import {
  uploadAvatar,
  deleteAvatar,
  deleteAccount,
  updateEmail,
  updatePassword,
  updateLanguagePreference,
} from '@/app/actions/profile';
import { createBillingPortalAction } from '@/app/actions/subscription';

// ============================================================================
// TYPES
// ============================================================================

interface UserProfile {
  id: string;
  email: string;
  discordUsername: string | null;
  avatarUrl: string | null;
  preferredLocale: string | null;
  createdAt: Date;
  subscription: {
    status: string;
    plan: {
      displayName: string | null;
    } | null;
  } | null;
  _count: {
    trades: number;
    accounts: number;
  };
}

interface SettingsContentProps {
  profile: UserProfile | null;
}

type Identity = UserIdentity;
type Provider = 'google' | 'apple' | 'discord';

// NOTE: Google and Apple providers are disabled until configured in Supabase Dashboard
const PROVIDERS: { id: Provider; name: string; icon: React.ComponentType<{ className?: string }>; enabled: boolean }[] = [
  { id: 'google', name: 'Google', icon: GoogleIcon, enabled: false },
  { id: 'apple', name: 'Apple', icon: Apple, enabled: false },
  { id: 'discord', name: 'Discord', icon: DiscordIcon, enabled: true },
];

const ENABLED_PROVIDERS = PROVIDERS.filter(p => p.enabled);

const LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function SettingsContent({ profile }: SettingsContentProps) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const currentLocale = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const [unlinkingIdentity, setUnlinkingIdentity] = useState<Identity | null>(null);
  const [hasPassword, setHasPassword] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Dialogs
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Form state
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const supabase = createClient();

  // Load linked identities
  useEffect(() => {
    loadIdentities();
  }, []);

  // Handle OAuth callback messages
  useEffect(() => {
    const linked = searchParams.get('linked');
    const error = searchParams.get('error');
    const subscription = searchParams.get('subscription');
    
    if (linked) {
      toast({ title: t('linkSuccess'), description: `${linked} ${t('linked')}` });
      router.replace('/settings');
      loadIdentities();
    }
    
    if (error) {
      toast({ title: tCommon('error'), description: t('socialLoginError'), variant: 'destructive' });
      router.replace('/settings');
    }

    if (subscription === 'success') {
      toast({ title: t('subscriptionSuccess'), description: t('subscriptionSuccessDesc') });
      router.replace('/settings');
    }
  }, [searchParams]);

  async function loadIdentities() {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (data?.identities) {
      setIdentities(data.identities);
      setHasPassword(data.identities.some(i => i.provider === 'email'));
    }
  }

  // ==================== AVATAR ====================
  
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('avatar', file);

    const result = await uploadAvatar(formData);
    
    if (result.success && result.data) {
      setAvatarUrl(result.data.avatarUrl);
      toast({ title: t('avatarUpdated') });
    } else if (!result.success) {
      toast({ title: tCommon('error'), description: result.error, variant: 'destructive' });
    }
    
    setUploadingAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDeleteAvatar() {
    setUploadingAvatar(true);
    const result = await deleteAvatar();
    
    if (result.success) {
      setAvatarUrl(null);
      toast({ title: t('avatarDeleted') });
    } else {
      toast({ title: tCommon('error'), description: result.error, variant: 'destructive' });
    }
    
    setUploadingAvatar(false);
  }

  // ==================== SOCIAL LOGIN ====================

  async function linkProvider(provider: Provider) {
    setLoadingProvider(provider);
    
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: {
        redirectTo: `${window.location.origin}/settings?linked=${provider}`,
        ...(provider === 'discord' && { scopes: 'identify email' }),
      },
    });

    if (error) {
      toast({ title: tCommon('error'), description: error.message, variant: 'destructive' });
    }
    
    setLoadingProvider(null);
  }

  async function unlinkProvider(identity: Identity) {
    if (identities.length <= 1) {
      toast({ title: tCommon('error'), description: t('cannotUnlinkLast'), variant: 'destructive' });
      return;
    }

    const { error } = await supabase.auth.unlinkIdentity(identity);
    
    if (error) {
      toast({ title: tCommon('error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('unlinkSuccess') });
      await loadIdentities();
    }
    
    setUnlinkingIdentity(null);
  }

  // ==================== EMAIL/PASSWORD ====================

  async function handleUpdateEmail() {
    if (!newEmail) return;
    
    setIsSubmitting(true);
    const result = await updateEmail(newEmail);
    
    if (result.success) {
      toast({ title: t('emailUpdateSent'), description: t('emailUpdateSentDesc') });
      setShowEmailDialog(false);
      setNewEmail('');
    } else {
      toast({ title: tCommon('error'), description: result.error, variant: 'destructive' });
    }
    
    setIsSubmitting(false);
  }

  async function handleUpdatePassword() {
    if (newPassword !== confirmPassword) {
      toast({ title: tCommon('error'), description: t('passwordMismatch'), variant: 'destructive' });
      return;
    }
    
    setIsSubmitting(true);
    const result = await updatePassword(currentPassword, newPassword);
    
    if (result.success) {
      toast({ title: t('passwordUpdated') });
      setShowPasswordDialog(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      toast({ title: tCommon('error'), description: result.error, variant: 'destructive' });
    }
    
    setIsSubmitting(false);
  }

  // ==================== LANGUAGE ====================

  async function handleLanguageChange(locale: string) {
    const result = await updateLanguagePreference(locale);
    
    if (result.success) {
      toast({ title: t('languageUpdated') });
      router.refresh();
    } else {
      toast({ title: tCommon('error'), description: result.error, variant: 'destructive' });
    }
  }

  // ==================== DELETE ACCOUNT ====================

  async function handleDeleteAccount() {
    if (!deleteConfirmEmail) return;
    
    setIsSubmitting(true);
    const result = await deleteAccount(deleteConfirmEmail);
    
    if (result.success) {
      toast({ title: t('accountDeleted') });
      router.push('/');
    } else {
      toast({ title: tCommon('error'), description: result.error, variant: 'destructive' });
    }
    
    setIsSubmitting(false);
  }

  // ==================== BILLING ====================

  async function handleManageBilling() {
    const result = await createBillingPortalAction();
    
    if (result.success && result.data?.url) {
      window.location.href = result.data.url;
    } else if (!result.success) {
      toast({ title: tCommon('error'), description: result.error, variant: 'destructive' });
    }
  }

  // ==================== HELPERS ====================

  const isLinked = (provider: Provider) => identities.some(i => i.provider === provider);
  const getIdentity = (provider: Provider) => identities.find(i => i.provider === provider);
  const canUnlink = identities.length > 1;
  const initials = profile?.email?.slice(0, 2).toUpperCase() || 'U';

  // ==================== RENDER ====================

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Profile Card with Avatar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('profileInfo')}
          </CardTitle>
          <CardDescription>{t('profileDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarUrl || undefined} alt={profile?.email || ''} />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Camera className="h-4 w-4 mr-2" />
                  )}
                  {t('changeAvatar')}
                </Button>
                {avatarUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteAvatar}
                    disabled={uploadingAvatar}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('removeAvatar')}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t('avatarHint')}</p>
            </div>
          </div>

          <Separator />

          {/* Profile Info */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {t('email')}
              </Label>
              <div className="flex gap-2">
                <Input value={profile?.email || ''} disabled className="bg-muted" />
                <Button variant="outline" size="icon" onClick={() => setShowEmailDialog(true)}>
                  <Key className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                {t('discordUsername')}
              </Label>
              <Input 
                value={profile?.discordUsername || ''} 
                disabled 
                className="bg-muted"
                placeholder={t('notSet')}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {t('memberSince')}
              </Label>
              <Input 
                value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : ''} 
                disabled 
                className="bg-muted" 
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                {t('language')}
              </Label>
              <Select value={currentLocale} onValueChange={handleLanguageChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={() => setShowPasswordDialog(true)}>
            <Key className="h-4 w-4 mr-2" />
            {t('changePassword')}
          </Button>
        </CardFooter>
      </Card>

      {/* Subscription Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('subscription')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {profile?.subscription?.plan?.displayName || t('freePlan')}
              </p>
              <p className="text-sm text-muted-foreground">
                {profile?.subscription?.status === 'ACTIVE' && t('statusActive')}
                {profile?.subscription?.status === 'TRIAL' && t('statusTrial')}
                {!profile?.subscription && t('noSubscription')}
              </p>
            </div>
            {profile?.subscription ? (
              <Button variant="outline" onClick={handleManageBilling}>
                {t('manageBilling')}
              </Button>
            ) : (
              <Button onClick={() => router.push('/pricing')}>
                {t('upgradeToPro')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Linked Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            {t('linkedAccounts')}
          </CardTitle>
          <CardDescription>{t('linkedAccountsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ENABLED_PROVIDERS.map(({ id, name, icon: Icon }) => {
              const linked = isLinked(id);
              const identity = getIdentity(id);
              const isLoading = loadingProvider === id;

              return (
                <div
                  key={id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      id === 'google' ? 'bg-white' :
                      id === 'apple' ? 'bg-black' :
                      'bg-[#5865F2]'
                    }`}>
                      <Icon className={`h-5 w-5 ${
                        id === 'google' ? 'text-black' : 'text-white'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium">{name}</p>
                      <p className="text-sm text-muted-foreground">
                        {linked ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <Check className="h-3 w-3" />
                            {t('linked')}
                          </span>
                        ) : t('notLinked')}
                      </p>
                    </div>
                  </div>

                  {linked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUnlinkingIdentity(identity!)}
                      disabled={!canUnlink}
                      className="gap-2"
                    >
                      <Unlink className="h-4 w-4" />
                      {t('unlink')}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => linkProvider(id)}
                      disabled={isLoading}
                      className="gap-2"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LinkIcon className="h-4 w-4" />
                      )}
                      {t('link')}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {!canUnlink && identities.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">{t('cannotUnlinkWarning')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Shield className="h-5 w-5" />
            {t('dangerZone')}
          </CardTitle>
          <CardDescription>{t('dangerZoneDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" />
                {t('deleteAccount')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('deleteAccountTitle')}</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>{t('deleteAccountWarning')}</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>{profile?._count?.trades || 0} trades</li>
                    <li>{profile?._count?.accounts || 0} comptes trading</li>
                    <li>{t('deleteAccountDataList')}</li>
                  </ul>
                  <p className="font-medium">{t('deleteAccountConfirmText')}</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 py-4">
                <Label>{t('confirmEmail')}</Label>
                <Input
                  placeholder={profile?.email}
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={isSubmitting || deleteConfirmEmail.toLowerCase() !== profile?.email?.toLowerCase()}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t('deleteAccountConfirm')}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* ==================== DIALOGS ==================== */}

      {/* Email Change Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('changeEmail')}</DialogTitle>
            <DialogDescription>{t('changeEmailDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('currentEmail')}</Label>
              <Input value={profile?.email || ''} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>{t('newEmail')}</Label>
              <Input
                type="email"
                placeholder="nouveau@email.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleUpdateEmail} disabled={isSubmitting || !newEmail}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('sendConfirmation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('changePassword')}</DialogTitle>
            <DialogDescription>{t('changePasswordDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('currentPassword')}</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('newPassword')}</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('confirmPassword')}</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleUpdatePassword}
              disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('updatePassword')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink Confirmation Dialog */}
      <AlertDialog open={!!unlinkingIdentity} onOpenChange={() => setUnlinkingIdentity(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unlinkConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('unlinkConfirmDescription', { provider: unlinkingIdentity?.provider })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unlinkingIdentity && unlinkProvider(unlinkingIdentity)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('unlink')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
