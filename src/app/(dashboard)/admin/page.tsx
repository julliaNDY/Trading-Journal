import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { isAdmin, getAllUsers } from '@/app/actions/admin';
import { AdminContent } from './admin-content';

export default async function AdminPage() {
  const user = await getUser();
  if (!user) {
    redirect('/login');
    return null;
  }

  // Check if user is admin
  const adminAccess = await isAdmin();
  if (!adminAccess) {
    // Redirect non-admins to dashboard - they should not know this page exists
    redirect('/dashboard');
    return null;
  }

  const users = await getAllUsers();

  return <AdminContent users={users} />;
}
