/**
 * Admin Brokers Management Page
 * Story 3.8: Admin CRUD for 240+ brokers
 */

import { Suspense } from 'react';
import { BrokersManagement } from '@/components/admin/brokers-management';

export const metadata = {
  title: 'Brokers Management | Admin',
  description: 'Manage supported brokers',
};

export default function BrokersPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Brokers Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage the list of supported brokers and their integration status
        </p>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <BrokersManagement />
      </Suspense>
    </div>
  );
}
