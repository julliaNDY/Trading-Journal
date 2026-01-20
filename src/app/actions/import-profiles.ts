'use server';

import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { CsvMapping } from '@/services/import-service';

export interface ImportProfile {
  id: string;
  userId: string;
  name: string;
  brokerName: string | null;
  mapping: CsvMapping;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get all import profiles for the current user
 * Includes system profiles
 */
export async function getImportProfiles(): Promise<ImportProfile[]> {
  const user = await getUser();
  if (!user) {
    throw new Error('Non authentifié');
  }

  const profiles = await prisma.importProfile.findMany({
    where: {
      OR: [
        { userId: user.id },
        { isSystem: true },
      ],
    },
    orderBy: [
      { isSystem: 'desc' }, // System profiles first
      { name: 'asc' },
    ],
  });

  return profiles.map((p) => ({
    ...p,
    mapping: JSON.parse(p.mapping) as CsvMapping,
  }));
}

/**
 * Get a specific import profile by ID
 */
export async function getImportProfile(id: string): Promise<ImportProfile | null> {
  const user = await getUser();
  if (!user) {
    throw new Error('Non authentifié');
  }

  const profile = await prisma.importProfile.findFirst({
    where: {
      id,
      OR: [
        { userId: user.id },
        { isSystem: true },
      ],
    },
  });

  if (!profile) return null;

  return {
    ...profile,
    mapping: JSON.parse(profile.mapping) as CsvMapping,
  };
}

/**
 * Create a new import profile
 */
export async function createImportProfile(
  name: string,
  brokerName: string | null,
  mapping: CsvMapping
): Promise<ImportProfile> {
  const user = await getUser();
  if (!user) {
    throw new Error('Non authentifié');
  }

  // Check if profile with same name already exists
  const existing = await prisma.importProfile.findUnique({
    where: {
      userId_name: {
        userId: user.id,
        name,
      },
    },
  });

  if (existing) {
    throw new Error('Un profil avec ce nom existe déjà');
  }

  const profile = await prisma.importProfile.create({
    data: {
      userId: user.id,
      name,
      brokerName,
      mapping: JSON.stringify(mapping),
      isSystem: false,
    },
  });

  revalidatePath('/importer');

  return {
    ...profile,
    mapping: JSON.parse(profile.mapping) as CsvMapping,
  };
}

/**
 * Update an existing import profile
 * System profiles cannot be updated
 */
export async function updateImportProfile(
  id: string,
  name: string,
  brokerName: string | null,
  mapping: CsvMapping
): Promise<ImportProfile> {
  const user = await getUser();
  if (!user) {
    throw new Error('Non authentifié');
  }

  // Check if profile exists and belongs to user
  const existing = await prisma.importProfile.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!existing) {
    throw new Error('Profil introuvable');
  }

  if (existing.isSystem) {
    throw new Error('Les profils système ne peuvent pas être modifiés');
  }

  // Check if new name conflicts with another profile
  if (name !== existing.name) {
    const nameConflict = await prisma.importProfile.findUnique({
      where: {
        userId_name: {
          userId: user.id,
          name,
        },
      },
    });

    if (nameConflict) {
      throw new Error('Un profil avec ce nom existe déjà');
    }
  }

  const profile = await prisma.importProfile.update({
    where: { id },
    data: {
      name,
      brokerName,
      mapping: JSON.stringify(mapping),
    },
  });

  revalidatePath('/importer');

  return {
    ...profile,
    mapping: JSON.parse(profile.mapping) as CsvMapping,
  };
}

/**
 * Delete an import profile
 * System profiles cannot be deleted
 */
export async function deleteImportProfile(id: string): Promise<void> {
  const user = await getUser();
  if (!user) {
    throw new Error('Non authentifié');
  }

  // Check if profile exists and belongs to user
  const existing = await prisma.importProfile.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!existing) {
    throw new Error('Profil introuvable');
  }

  if (existing.isSystem) {
    throw new Error('Les profils système ne peuvent pas être supprimés');
  }

  await prisma.importProfile.delete({
    where: { id },
  });

  revalidatePath('/importer');
}

/**
 * Get import profiles by broker name
 */
export async function getImportProfilesByBroker(brokerName: string): Promise<ImportProfile[]> {
  const user = await getUser();
  if (!user) {
    throw new Error('Non authentifié');
  }

  const profiles = await prisma.importProfile.findMany({
    where: {
      brokerName,
      OR: [
        { userId: user.id },
        { isSystem: true },
      ],
    },
    orderBy: [
      { isSystem: 'desc' },
      { name: 'asc' },
    ],
  });

  return profiles.map((p) => ({
    ...p,
    mapping: JSON.parse(p.mapping) as CsvMapping,
  }));
}
