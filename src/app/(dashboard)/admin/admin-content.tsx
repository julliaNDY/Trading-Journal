'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Shield, Users, Ban, CheckCircle, Loader2 } from 'lucide-react';
import { toggleUserBlock } from '@/app/actions/admin';

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
  const [users, setUsers] = useState(initialUsers);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

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
    } finally {
      setLoadingUserId(null);
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
                        <Button
                          variant={user.isBlocked ? 'outline' : 'destructive'}
                          size="sm"
                          onClick={() => handleToggleBlock(user.id)}
                          disabled={loadingUserId === user.id}
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
