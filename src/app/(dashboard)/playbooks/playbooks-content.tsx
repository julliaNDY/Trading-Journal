'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  Loader2,
  BarChart3,
  ListChecks,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import {
  createPlaybook,
  updatePlaybook,
  deletePlaybook,
  addPlaybookGroup,
  updatePlaybookGroup,
  deletePlaybookGroup,
  addPrerequisite,
  updatePrerequisite,
  deletePrerequisite,
  getPlaybooks,
} from '@/app/actions/playbooks';

interface PlaybookStats {
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  tradesCount: number;
}

interface Prerequisite {
  id: string;
  text: string;
  order: number;
}

interface PlaybookGroup {
  id: string;
  name: string;
  order: number;
  prerequisites: Prerequisite[];
}

interface Playbook {
  id: string;
  name: string;
  description: string | null;
  groups: PlaybookGroup[];
  stats: PlaybookStats;
}

interface PlaybooksContentProps {
  playbooks: Playbook[];
}

export function PlaybooksContent({ playbooks: initialPlaybooks }: PlaybooksContentProps) {
  const t = useTranslations('playbooks');
  const tCommon = useTranslations('common');
  const router = useRouter();
  
  const [playbooks, setPlaybooks] = useState<Playbook[]>(initialPlaybooks);
  const [isCreating, setIsCreating] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null);
  const [deletingPlaybook, setDeletingPlaybook] = useState<Playbook | null>(null);
  const [expandedPlaybooks, setExpandedPlaybooks] = useState<Set<string>>(new Set());
  
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Refresh playbooks data from server
  const refreshPlaybooks = useCallback(async () => {
    const data = await getPlaybooks();
    setPlaybooks(data);
  }, []);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedPlaybooks);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedPlaybooks(newExpanded);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsSaving(true);
    try {
      const newPlaybook = await createPlaybook(newName.trim(), newDescription.trim() || undefined);
      // Add to local state immediately with default stats
      setPlaybooks(prev => [{
        ...newPlaybook,
        groups: [],
        stats: { totalPnl: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, tradesCount: 0 }
      }, ...prev]);
      setNewName('');
      setNewDescription('');
      setIsCreating(false);
      // Expand the new playbook
      setExpandedPlaybooks(prev => new Set([...prev, newPlaybook.id]));
    } catch (error) {
      console.error('Error creating playbook:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingPlaybook || !newName.trim()) return;
    setIsSaving(true);
    try {
      await updatePlaybook(editingPlaybook.id, newName.trim(), newDescription.trim() || undefined);
      // Update local state
      setPlaybooks(prev => prev.map(p => 
        p.id === editingPlaybook.id 
          ? { ...p, name: newName.trim(), description: newDescription.trim() || null }
          : p
      ));
      setEditingPlaybook(null);
      setNewName('');
      setNewDescription('');
    } catch (error) {
      console.error('Error updating playbook:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPlaybook) return;
    try {
      await deletePlaybook(deletingPlaybook.id);
      // Remove from local state
      setPlaybooks(prev => prev.filter(p => p.id !== deletingPlaybook.id));
      setDeletingPlaybook(null);
    } catch (error) {
      console.error('Error deleting playbook:', error);
    }
  };

  const openEdit = (playbook: Playbook) => {
    setNewName(playbook.name);
    setNewDescription(playbook.description || '');
    setEditingPlaybook(playbook);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('createPlaybook')}
        </Button>
      </div>

      {/* Playbooks List */}
      {playbooks.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <ListChecks className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t('noPlaybooks')}</h3>
              <p className="text-muted-foreground mb-4">{t('createFirst')}</p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('createPlaybook')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {playbooks.map((playbook) => (
            <PlaybookCard
              key={playbook.id}
              playbook={playbook}
              isExpanded={expandedPlaybooks.has(playbook.id)}
              onToggle={() => toggleExpanded(playbook.id)}
              onEdit={() => openEdit(playbook)}
              onDelete={() => setDeletingPlaybook(playbook)}
              onPlaybookChange={refreshPlaybooks}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createPlaybook')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('playbookName')}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('playbookNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('playbookDescription')}</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder={t('playbookDescriptionPlaceholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={isSaving || !newName.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tCommon('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingPlaybook} onOpenChange={() => setEditingPlaybook(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editPlaybook')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('playbookName')}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('playbookNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('playbookDescription')}</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder={t('playbookDescriptionPlaceholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlaybook(null)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving || !newName.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPlaybook} onOpenChange={() => setDeletingPlaybook(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PlaybookCard({
  playbook,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onPlaybookChange,
}: {
  playbook: Playbook;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPlaybookChange: () => Promise<void>;
}) {
  const t = useTranslations('playbooks');
  const router = useRouter();
  const [groups, setGroups] = useState(playbook.groups);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    setIsSaving(true);
    try {
      const newGroup = await addPlaybookGroup(playbook.id, newGroupName.trim());
      // Add to local state
      setGroups(prev => [...prev, { ...newGroup, prerequisites: [] }]);
      setNewGroupName('');
      setIsAddingGroup(false);
    } catch (error) {
      console.error('Error adding group:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGroupChange = async () => {
    // Refresh from parent to get updated data
    await onPlaybookChange();
  };

  const handleGroupDelete = (groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const handleGroupUpdate = (groupId: string, newName: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: newName } : g));
  };

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-left hover:text-primary transition-colors">
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
                <div>
                  <CardTitle className="text-xl">{playbook.name}</CardTitle>
                  {playbook.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {playbook.description}
                    </p>
                  )}
                </div>
              </button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onEdit}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-5 gap-4 mt-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('totalPnl')}</p>
              <p className={cn(
                'text-lg font-bold',
                playbook.stats.totalPnl >= 0 ? 'text-success' : 'text-destructive'
              )}>
                {playbook.stats.totalPnl >= 0 ? '+' : ''}{formatCurrency(playbook.stats.totalPnl)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('avgWin')}</p>
              <p className="text-lg font-bold text-success">
                +{formatCurrency(playbook.stats.avgWin)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('avgLoss')}</p>
              <p className="text-lg font-bold text-destructive">
                -{formatCurrency(playbook.stats.avgLoss)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('profitFactor')}</p>
              <p className="text-lg font-bold">
                {formatNumber(playbook.stats.profitFactor, 2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('tradesCount')}</p>
              <p className="text-lg font-bold">{playbook.stats.tradesCount}</p>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Groups */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{t('groups')}</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingGroup(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t('addGroup')}
                </Button>
              </div>

              {isAddingGroup && (
                <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder={t('groupNamePlaceholder')}
                    className="flex-1"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
                  />
                  <Button size="sm" onClick={handleAddGroup} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('addGroup')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsAddingGroup(false);
                      setNewGroupName('');
                    }}
                  >
                    ✕
                  </Button>
                </div>
              )}

              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('noGroups')}
                </p>
              ) : (
                <div className="space-y-3">
                  {groups.map((group) => (
                    <GroupCard 
                      key={group.id} 
                      group={group} 
                      playbookId={playbook.id}
                      onDelete={() => handleGroupDelete(group.id)}
                      onUpdate={(name) => handleGroupUpdate(group.id, name)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* View Trades Button */}
            {playbook.stats.tradesCount > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/trades?playbook=${playbook.id}`)}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  {t('viewTrades')} ({playbook.stats.tradesCount})
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function GroupCard({ 
  group, 
  playbookId,
  onDelete,
  onUpdate,
}: { 
  group: PlaybookGroup; 
  playbookId: string;
  onDelete: () => void;
  onUpdate: (name: string) => void;
}) {
  const t = useTranslations('playbooks');
  const [prerequisites, setPrerequisites] = useState(group.prerequisites);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [isAddingPrereq, setIsAddingPrereq] = useState(false);
  const [newPrereqText, setNewPrereqText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdateGroup = async () => {
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      await updatePlaybookGroup(group.id, editName.trim());
      onUpdate(editName.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating group:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    try {
      await deletePlaybookGroup(group.id);
      onDelete();
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  const handleAddPrereq = async () => {
    if (!newPrereqText.trim()) return;
    setIsSaving(true);
    try {
      const newPrereq = await addPrerequisite(group.id, newPrereqText.trim());
      setPrerequisites(prev => [...prev, newPrereq]);
      setNewPrereqText('');
      setIsAddingPrereq(false);
    } catch (error) {
      console.error('Error adding prerequisite:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrereqDelete = (prereqId: string) => {
    setPrerequisites(prev => prev.filter(p => p.id !== prereqId));
  };

  const handlePrereqUpdate = (prereqId: string, newText: string) => {
    setPrerequisites(prev => prev.map(p => p.id === prereqId ? { ...p, text: newText } : p));
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-8"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateGroup()}
            />
            <Button size="sm" onClick={handleUpdateGroup} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : '✓'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setEditName(group.name); }}>
              ✕
            </Button>
          </div>
        ) : (
          <>
            <h5 className="font-medium">{group.name}</h5>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDeleteGroup}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Prerequisites */}
      <div className="space-y-1 pl-2">
        {prerequisites.map((prereq) => (
          <PrerequisiteItem 
            key={prereq.id} 
            prerequisite={prereq}
            onDelete={() => handlePrereqDelete(prereq.id)}
            onUpdate={(text) => handlePrereqUpdate(prereq.id, text)}
          />
        ))}

        {isAddingPrereq ? (
          <div className="flex items-center gap-2">
            <Input
              value={newPrereqText}
              onChange={(e) => setNewPrereqText(e.target.value)}
              placeholder={t('prerequisitePlaceholder')}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAddPrereq()}
            />
            <Button size="sm" onClick={handleAddPrereq} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : '✓'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsAddingPrereq(false); setNewPrereqText(''); }}>
              ✕
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => setIsAddingPrereq(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('addPrerequisite')}
          </Button>
        )}
      </div>
    </div>
  );
}

function PrerequisiteItem({ 
  prerequisite,
  onDelete,
  onUpdate,
}: { 
  prerequisite: Prerequisite;
  onDelete: () => void;
  onUpdate: (text: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(prerequisite.text);
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdate = async () => {
    if (!editText.trim()) return;
    setIsSaving(true);
    try {
      await updatePrerequisite(prerequisite.id, editText.trim());
      onUpdate(editText.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating prerequisite:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deletePrerequisite(prerequisite.id);
      onDelete();
    } catch (error) {
      console.error('Error deleting prerequisite:', error);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="h-7 text-sm"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
        />
        <Button size="sm" className="h-7" onClick={handleUpdate} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : '✓'}
        </Button>
        <Button size="sm" variant="ghost" className="h-7" onClick={() => { setIsEditing(false); setEditText(prerequisite.text); }}>
          ✕
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between group text-sm py-1">
      <span className="text-muted-foreground">• {prerequisite.text}</span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditing(true)}>
          <Edit2 className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDelete}>
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
