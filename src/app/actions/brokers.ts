/**
 * Broker Management Server Actions
 * Story 3.8: Admin CRUD for brokers
 */

'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { BrokerAssetType, IntegrationStatus } from '@prisma/client';
import { createClient } from '@/lib/supabase/server';
import { cacheDeletePattern } from '@/lib/cache';
import { logger } from '@/lib/observability';

const brokerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  displayName: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  integrationStatus: z.nativeEnum(IntegrationStatus),
  supportedAssets: z.array(z.nativeEnum(BrokerAssetType)),
  logoUrl: z.string().url().optional().or(z.literal('')),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  apiDocumentationUrl: z.string().url().optional().or(z.literal('')),
  csvTemplateUrl: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),
  priority: z.number().int().min(0).max(100).default(50),
  isActive: z.boolean().default(true),
});

type BrokerInput = z.infer<typeof brokerSchema>;

/**
 * Check if user is admin
 */
async function checkAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Check if user is admin (you can customize this logic)
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  // For now, we'll check if user email contains 'admin' or has a specific flag
  // You should implement proper admin role checking
  const isAdmin = user.email?.includes('admin') || dbUser?.email?.includes('admin');

  if (!isAdmin) {
    throw new Error('Admin access required');
  }

  return user;
}

/**
 * Invalidate all broker caches
 */
async function invalidateBrokerCache() {
  try {
    // Delete all broker list caches (all filter combinations)
    await cacheDeletePattern('brokers:*');
    logger.info('Broker cache invalidated');
  } catch (error) {
    logger.error('Failed to invalidate broker cache', { error });
  }
}

/**
 * Create a new broker
 */
export async function createBroker(data: BrokerInput) {
  try {
    await checkAdminAccess();

    const validated = brokerSchema.parse(data);

    const broker = await prisma.broker.create({
      data: {
        ...validated,
        logoUrl: validated.logoUrl || null,
        websiteUrl: validated.websiteUrl || null,
        apiDocumentationUrl: validated.apiDocumentationUrl || null,
        csvTemplateUrl: validated.csvTemplateUrl || null,
        displayName: validated.displayName || null,
        country: validated.country || null,
        region: validated.region || null,
        description: validated.description || null,
      },
    });

    // Invalidate cache and revalidate paths
    await invalidateBrokerCache();
    revalidatePath('/admin/brokers');
    revalidatePath('/api/brokers');

    logger.info('Broker created', { brokerId: broker.id, name: broker.name });

    return {
      success: true,
      data: broker,
    };
  } catch (error) {
    logger.error('Error creating broker', { error });

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        details: error.errors,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create broker',
    };
  }
}

/**
 * Update an existing broker
 */
export async function updateBroker(id: string, data: Partial<BrokerInput>) {
  try {
    await checkAdminAccess();

    const validated = brokerSchema.partial().parse(data);

    const broker = await prisma.broker.update({
      where: { id },
      data: {
        ...validated,
        logoUrl: validated.logoUrl === '' ? null : validated.logoUrl,
        websiteUrl: validated.websiteUrl === '' ? null : validated.websiteUrl,
        apiDocumentationUrl: validated.apiDocumentationUrl === '' ? null : validated.apiDocumentationUrl,
        csvTemplateUrl: validated.csvTemplateUrl === '' ? null : validated.csvTemplateUrl,
        displayName: validated.displayName === '' ? null : validated.displayName,
        country: validated.country === '' ? null : validated.country,
        region: validated.region === '' ? null : validated.region,
        description: validated.description === '' ? null : validated.description,
      },
    });

    // Invalidate cache and revalidate paths
    await invalidateBrokerCache();
    revalidatePath('/admin/brokers');
    revalidatePath('/api/brokers');

    logger.info('Broker updated', { brokerId: broker.id, name: broker.name });

    return {
      success: true,
      data: broker,
    };
  } catch (error) {
    logger.error('Error updating broker', { error, brokerId: id });

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        details: error.errors,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update broker',
    };
  }
}

/**
 * Delete a broker
 */
export async function deleteBroker(id: string) {
  try {
    await checkAdminAccess();

    await prisma.broker.delete({
      where: { id },
    });

    // Invalidate cache and revalidate paths
    await invalidateBrokerCache();
    revalidatePath('/admin/brokers');
    revalidatePath('/api/brokers');

    logger.info('Broker deleted', { brokerId: id });

    return {
      success: true,
    };
  } catch (error) {
    logger.error('Error deleting broker', { error, brokerId: id });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete broker',
    };
  }
}

/**
 * Get a single broker by ID
 */
export async function getBroker(id: string) {
  try {
    const broker = await prisma.broker.findUnique({
      where: { id },
    });

    if (!broker) {
      return {
        success: false,
        error: 'Broker not found',
      };
    }

    return {
      success: true,
      data: broker,
    };
  } catch (error) {
    console.error('Error fetching broker:', error);

    return {
      success: false,
      error: 'Failed to fetch broker',
    };
  }
}

/**
 * Get broker statistics
 */
export async function getBrokerStats() {
  try {
    const [total, byStatus, byRegion] = await Promise.all([
      prisma.broker.count(),
      prisma.broker.groupBy({
        by: ['integrationStatus'],
        _count: true,
      }),
      prisma.broker.groupBy({
        by: ['region'],
        _count: true,
        orderBy: {
          _count: {
            region: 'desc',
          },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        total,
        byStatus,
        byRegion,
      },
    };
  } catch (error) {
    console.error('Error fetching broker stats:', error);

    return {
      success: false,
      error: 'Failed to fetch statistics',
    };
  }
}
