'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Shield, Users, Ban, CheckCircle, Loader2, Trash2, RefreshCcw, AlertTriangle } from 'lucide-react';
import { toggleUserBlock, cleanupOrphanedUsers, deleteUser } from '@/app/actions/admin';
import { useToast } from '@/hooks/use-toast';

// Admin emails list (must match the one in admin.ts)
const ADMIN_EMAILS = [
  'j.bengueche@gmail.com',
  'carmor.ttp@gmail.com',
];

interface User {
  id: string;
  email: string;
  discordUsername: string | null;
  createdAt: Date;
  isBlocked: boolean;
}

interface AdminContentProps {
  users: User[];
}

export function AdminContent({ users: initialUsers }: AdminContentProps) {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleToggleBlock = async (userId: string) => {
    setLoadingUserId(userId);
    try {
      const result = await toggleUserBlock(userId);
      if (result.success) {
        setUsers(prev => prev.map(user => 
          user.id === userId ? { ...user, isBlocked: result.isBlocked } : user
        ));
      }
    } catch (error) {
      console.error('Error toggling user block:', error);
      toast({ title: t('errorToggleBlock'), variant: 'destructive' });
    } finally {
      setLoadingUserId(null);
    }
  };

  const handleCleanupOrphanedUsers = async () => {
    setIsCleaningUp(true);
    try {
      const result = await cleanupOrphanedUsers();
      if (result.success) {
        if (result.deletedCount > 0) {
          // Remove deleted users from local state
          setUsers(prev => prev.filter(u => !result.orphanedIds.includes(u.id)));
          toast({ title: t('cleanupSuccess', { count: result.deletedCount }) });
        } else {
          toast({ title: t('noOrphanedUsers') });
        }
      } else {
        toast({ title: result.error || t('cleanupError'), variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error cleaning up orphaned users:', error);
      toast({ title: t('cleanupError'), variant: 'destructive' });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    try {
      const result = await deleteUser(userId);
      if (result.success) {
        setUsers(prev => prev.filter(u => u.id !== userId));
        toast({ title: t('deleteSuccess') });
      } else {
        toast({ title: result.error || t('deleteError'), variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({ title: t('deleteError'), variant: 'destructive' });
    } finally {
      setDeletingUserId(null);
    }
  };

  const isAdminUser = (email: string) => ADMIN_EMAILS.includes(email);
  const blockedCount = users.filter(u => u.isBlocked).length;
  const activeCount = users.filter(u => !u.isBlocked && !isAdminUser(u.email)).length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('totalUsers')}</p>
                <p className="text-3xl font-bold">{users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('activeUsers')}</p>
                <p className="text-3xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/10">
                <Ban className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('blockedUsers')}</p>
                <p className="text-3xl font-bold">{blockedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Maintenance Section */}
      <Card className="border-yellow-500/20 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-600">
            <AlertTriangle className="w-5 h-5" />
            {t('maintenance')}
          </CardTitle>
          <CardDescription>
            {t('maintenanceDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('cleanupOrphanedUsers')}</p>
              <p className="text-sm text-muted-foreground">
                {t('cleanupOrphanedUsersDescription')}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleCleanupOrphanedUsers}
              disabled={isCleaningUp}
              className="border-yellow-500/50 hover:bg-yellow-500/10"
            >
              {isCleaningUp ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCcw className="h-4 w-4 mr-2" />
              )}
              {t('runCleanup')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t('usersList')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('email')}</TableHead>
                <TableHead>{t('discord')}</TableHead>
                <TableHead>{t('registeredAt')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isAdmin = isAdminUser(user.email);
                return (
                  <TableRow key={user.id} className={user.isBlocked ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">
                      {user.email}
                      {isAdmin && (
                        <Badge variant="secondary" className="ml-2">
                          Admin
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.discordUsername || (
                        <span className="text-muted-foreground italic">-</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Badge variant="outline" className="bg-primary/10 text-primary">
                          {t('adminStatus')}
                        </Badge>
                      ) : user.isBlocked ? (
                        <Badge variant="destructive">
                          {t('blocked')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600">
                          {t('active')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isAdmin && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant={user.isBlocked ? 'outline' : 'destructive'}
                            size="sm"
                            onClick={() => handleToggleBlock(user.id)}
                            disabled={loadingUserId === user.id || deletingUserId === user.id}
                          >
                            {loadingUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : user.isBlocked ? (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                {t('unblock')}
                              </>
                            ) : (
                              <>
                                <Ban className="h-4 w-4 mr-1" />
                                {t('block')}
                              </>
                            )}
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                disabled={deletingUserId === user.id}
                              >
                                {deletingUserId === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('confirmDeleteTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('confirmDeleteDescription', { email: user.email })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {t('delete')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {t('noUsers')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
