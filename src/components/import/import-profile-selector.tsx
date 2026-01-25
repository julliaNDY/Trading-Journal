'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getImportProfiles, deleteImportProfile } from '@/app/actions/import-profiles';
import type { ImportProfile } from '@/app/actions/import-profiles';
import { ImportProfileDialog } from './import-profile-dialog';

interface ImportProfileSelectorProps {
  csvHeaders?: string[];
  selectedProfileId?: string;
  onProfileSelect: (profile: ImportProfile | null) => void;
  detectedBroker?: {
    brokerName: string;
    displayName: string;
  } | null;
}

export function ImportProfileSelector({
  csvHeaders = [],
  selectedProfileId,
  onProfileSelect,
  detectedBroker,
}: ImportProfileSelectorProps) {
  const t = useTranslations('import.profiles');
  const tCommon = useTranslations('common');
  const { toast } = useToast();

  const [profiles, setProfiles] = useState<ImportProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ImportProfile | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<ImportProfile | null>(null);

  // Load profiles
  const loadProfiles = async () => {
    setIsLoading(true);
    try {
      const data = await getImportProfiles();
      setProfiles(data);

      // Auto-select detected broker profile if available
      if (detectedBroker && !selectedProfileId) {
        const matchingProfile = data.find(
          (p) => p.brokerName === detectedBroker.brokerName && p.isSystem
        );
        if (matchingProfile) {
          onProfileSelect(matchingProfile);
        }
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast({
        title: t('error'),
        description: t('loadError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleProfileChange = (profileId: string) => {
    if (profileId === 'new') {
      setShowCreateDialog(true);
      return;
    }

    const profile = profiles.find((p) => p.id === profileId);
    onProfileSelect(profile || null);

    // Save to localStorage for next time
    if (profile) {
      localStorage.setItem('lastImportProfileId', profile.id);
    }
  };

  const handleEdit = () => {
    const profile = profiles.find((p) => p.id === selectedProfileId);
    if (profile && !profile.isSystem) {
      setEditingProfile(profile);
      setShowEditDialog(true);
    }
  };

  const handleDelete = () => {
    const profile = profiles.find((p) => p.id === selectedProfileId);
    if (profile && !profile.isSystem) {
      setProfileToDelete(profile);
      setDeleteDialogOpen(true);
    }
  };

  const confirmDelete = async () => {
    if (!profileToDelete) return;

    try {
      await deleteImportProfile(profileToDelete.id);
      toast({
        title: t('success'),
        description: t('profileDeleted'),
      });
      
      // Clear selection if deleted profile was selected
      if (selectedProfileId === profileToDelete.id) {
        onProfileSelect(null);
      }
      
      await loadProfiles();
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('unknownError'),
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setProfileToDelete(null);
    }
  };

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  return (
    <div className="space-y-4">
      {/* Detected Broker Banner */}
      {detectedBroker && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Sparkles className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {t('brokerDetected', { broker: detectedBroker.displayName })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('brokerDetectedDescription')}
            </p>
          </div>
        </div>
      )}

      {/* Profile Selector */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select
            value={selectedProfileId || undefined}
            onValueChange={handleProfileChange}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('selectProfile')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {t('createNewProfile')}
                </div>
              </SelectItem>
              
              {profiles.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    {t('systemProfiles')}
                  </div>
                  {profiles
                    .filter((p) => p.isSystem)
                    .map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        <div className="flex items-center gap-2">
                          {profile.name}
                          <Badge variant="secondary" className="text-xs">
                            {t('system')}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}

                  {profiles.some((p) => !p.isSystem) && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {t('myProfiles')}
                      </div>
                      {profiles
                        .filter((p) => !p.isSystem)
                        .map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.name}
                          </SelectItem>
                        ))}
                    </>
                  )}
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        {selectedProfile && !selectedProfile.isSystem && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={handleEdit}
              title={t('editProfile')}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleDelete}
              title={t('deleteProfile')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Profile Info */}
      {selectedProfile && (
        <div className="p-3 rounded-lg bg-muted/50 text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">{selectedProfile.name}</span>
            {selectedProfile.isSystem && (
              <Badge variant="secondary" className="text-xs">
                {t('system')}
              </Badge>
            )}
          </div>
          {selectedProfile.brokerName && (
            <p className="text-xs text-muted-foreground">
              {t('broker')}: {selectedProfile.brokerName}
            </p>
          )}
        </div>
      )}

      {/* Dialogs */}
      <ImportProfileDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        csvHeaders={csvHeaders}
        onSuccess={loadProfiles}
      />

      <ImportProfileDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        profile={editingProfile}
        csvHeaders={csvHeaders}
        onSuccess={loadProfiles}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirmDescription', { name: profileToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              {t('deleteProfile')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
