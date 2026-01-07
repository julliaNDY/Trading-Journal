'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import {
  setPlaybookVisibilitySchema,
  getPublicPlaybooksSchema,
  importPlaybookSchema,
  shareTokenSchema,
  type PlaybookVisibilityType,
} from '@/lib/validations';

// Type alias for PlaybookVisibility since Prisma client may not be regenerated yet
type PlaybookVisibility = 'PRIVATE' | 'UNLISTED' | 'PUBLIC';

// Get all playbooks for user with stats
export async function getPlaybooks() {
  const user = await getUser();
  if (!user) return [];

  const playbooks = await prisma.playbook.findMany({
    where: { userId: user.id },
    include: {
      groups: {
        include: {
          prerequisites: true,
        },
        orderBy: { order: 'asc' },
      },
      tradePlaybooks: {
        include: {
          trade: {
            select: {
              realizedPnlUsd: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate stats for each playbook
  return playbooks.map((playbook) => {
    const trades = playbook.tradePlaybooks.map((tp) => tp.trade);
    const winningTrades = trades.filter((t) => Number(t.realizedPnlUsd) > 0);
    const losingTrades = trades.filter((t) => Number(t.realizedPnlUsd) < 0);

    const totalPnl = trades.reduce((sum, t) => sum + Number(t.realizedPnlUsd), 0);
    const grossProfit = winningTrades.reduce((sum, t) => sum + Number(t.realizedPnlUsd), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + Number(t.realizedPnlUsd), 0));

    const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    return {
      ...playbook,
      // Sharing stats (AC: 6)
      visibility: playbook.visibility,
      shareToken: playbook.shareToken,
      viewCount: playbook.viewCount,
      importCount: playbook.importCount,
      originalPlaybookId: playbook.originalPlaybookId,
      originalAuthorId: playbook.originalAuthorId,
      stats: {
        totalPnl,
        avgWin,
        avgLoss,
        profitFactor: isFinite(profitFactor) ? profitFactor : 0,
        tradesCount: trades.length,
      },
    };
  });
}

// Get single playbook with trades
export async function getPlaybookWithTrades(playbookId: string) {
  const user = await getUser();
  if (!user) return null;

  const playbook = await prisma.playbook.findFirst({
    where: { id: playbookId, userId: user.id },
    include: {
      groups: {
        include: {
          prerequisites: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
      tradePlaybooks: {
        include: {
          trade: true,
          checkedPrerequisites: true,
        },
      },
    },
  });

  return playbook;
}

// Create playbook
export async function createPlaybook(name: string, description?: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  const playbook = await prisma.playbook.create({
    data: {
      userId: user.id,
      name,
      description,
    },
  });

  revalidatePath('/playbooks');
  return playbook;
}

// Update playbook
export async function updatePlaybook(playbookId: string, name: string, description?: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  await prisma.playbook.update({
    where: { id: playbookId, userId: user.id },
    data: { name, description },
  });

  revalidatePath('/playbooks');
}

// Delete playbook
export async function deletePlaybook(playbookId: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  await prisma.playbook.delete({
    where: { id: playbookId, userId: user.id },
  });

  revalidatePath('/playbooks');
  revalidatePath('/trades');
}

// Add group to playbook
export async function addPlaybookGroup(playbookId: string, name: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  // Verify ownership
  const playbook = await prisma.playbook.findFirst({
    where: { id: playbookId, userId: user.id },
  });
  if (!playbook) throw new Error('Playbook not found');

  // Get max order
  const maxOrder = await prisma.playbookGroup.aggregate({
    where: { playbookId },
    _max: { order: true },
  });

  const group = await prisma.playbookGroup.create({
    data: {
      playbookId,
      name,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath('/playbooks');
  return group;
}

// Update group
export async function updatePlaybookGroup(groupId: string, name: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  // Verify ownership through playbook
  const group = await prisma.playbookGroup.findFirst({
    where: { id: groupId },
    include: { playbook: true },
  });
  if (!group || group.playbook.userId !== user.id) throw new Error('Group not found');

  await prisma.playbookGroup.update({
    where: { id: groupId },
    data: { name },
  });

  revalidatePath('/playbooks');
}

// Delete group
export async function deletePlaybookGroup(groupId: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  // Verify ownership through playbook
  const group = await prisma.playbookGroup.findFirst({
    where: { id: groupId },
    include: { playbook: true },
  });
  if (!group || group.playbook.userId !== user.id) throw new Error('Group not found');

  await prisma.playbookGroup.delete({
    where: { id: groupId },
  });

  revalidatePath('/playbooks');
}

// Add prerequisite to group
export async function addPrerequisite(groupId: string, text: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  // Verify ownership through playbook
  const group = await prisma.playbookGroup.findFirst({
    where: { id: groupId },
    include: { playbook: true },
  });
  if (!group || group.playbook.userId !== user.id) throw new Error('Group not found');

  // Get max order
  const maxOrder = await prisma.playbookPrerequisite.aggregate({
    where: { groupId },
    _max: { order: true },
  });

  const prerequisite = await prisma.playbookPrerequisite.create({
    data: {
      groupId,
      text,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath('/playbooks');
  return prerequisite;
}

// Update prerequisite
export async function updatePrerequisite(prerequisiteId: string, text: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  // Verify ownership
  const prerequisite = await prisma.playbookPrerequisite.findFirst({
    where: { id: prerequisiteId },
    include: { group: { include: { playbook: true } } },
  });
  if (!prerequisite || prerequisite.group.playbook.userId !== user.id) {
    throw new Error('Prerequisite not found');
  }

  await prisma.playbookPrerequisite.update({
    where: { id: prerequisiteId },
    data: { text },
  });

  revalidatePath('/playbooks');
}

// Delete prerequisite
export async function deletePrerequisite(prerequisiteId: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  // Verify ownership
  const prerequisite = await prisma.playbookPrerequisite.findFirst({
    where: { id: prerequisiteId },
    include: { group: { include: { playbook: true } } },
  });
  if (!prerequisite || prerequisite.group.playbook.userId !== user.id) {
    throw new Error('Prerequisite not found');
  }

  await prisma.playbookPrerequisite.delete({
    where: { id: prerequisiteId },
  });

  revalidatePath('/playbooks');
}

// Assign playbook to trade
export async function assignPlaybookToTrade(
  tradeId: string,
  playbookId: string,
  checkedPrerequisiteIds: string[]
) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  // Verify trade ownership
  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId: user.id },
  });
  if (!trade) throw new Error('Trade not found');

  // Verify playbook ownership
  const playbook = await prisma.playbook.findFirst({
    where: { id: playbookId, userId: user.id },
    include: {
      groups: {
        include: { prerequisites: true },
      },
    },
  });
  if (!playbook) throw new Error('Playbook not found');

  // Create or update trade-playbook link
  const tradePlaybook = await prisma.tradePlaybook.upsert({
    where: {
      tradeId_playbookId: { tradeId, playbookId },
    },
    create: {
      tradeId,
      playbookId,
    },
    update: {},
  });

  // Delete existing checked prerequisites
  await prisma.tradePlaybookPrerequisite.deleteMany({
    where: { tradePlaybookId: tradePlaybook.id },
  });

  // Get all prerequisite IDs from this playbook
  const allPrerequisiteIds = playbook.groups.flatMap((g) =>
    g.prerequisites.map((p) => p.id)
  );

  // Create checked prerequisites records
  if (allPrerequisiteIds.length > 0) {
    await prisma.tradePlaybookPrerequisite.createMany({
      data: allPrerequisiteIds.map((prereqId) => ({
        tradePlaybookId: tradePlaybook.id,
        prerequisiteId: prereqId,
        checked: checkedPrerequisiteIds.includes(prereqId),
      })),
    });
  }

  revalidatePath('/playbooks');
  revalidatePath('/trades');
  revalidatePath('/journal');
}

// Remove playbook from trade
export async function removePlaybookFromTrade(tradeId: string, playbookId: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');

  // Verify trade ownership
  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId: user.id },
  });
  if (!trade) throw new Error('Trade not found');

  await prisma.tradePlaybook.delete({
    where: {
      tradeId_playbookId: { tradeId, playbookId },
    },
  });

  revalidatePath('/playbooks');
  revalidatePath('/trades');
  revalidatePath('/journal');
}

// Get trade's playbooks with checked prerequisites
export async function getTradePlaybooks(tradeId: string) {
  const user = await getUser();
  if (!user) return [];

  const tradePlaybooks = await prisma.tradePlaybook.findMany({
    where: {
      tradeId,
      trade: { userId: user.id },
    },
    include: {
      playbook: {
        include: {
          groups: {
            include: {
              prerequisites: true,
            },
            orderBy: { order: 'asc' },
          },
        },
      },
      checkedPrerequisites: true,
    },
  });

  return tradePlaybooks;
}

// ==================== PLAYBOOK SHARING API ====================

// Types for public playbooks
export interface PublicPlaybook {
  id: string;
  name: string;
  description: string | null;
  author: {
    id: string;
    displayName: string;
  };
  groupsCount: number;
  prerequisitesCount: number;
  importCount: number;
  createdAt: Date;
}

export interface PublicPlaybooksResponse {
  playbooks: PublicPlaybook[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ImportResult {
  success: boolean;
  newPlaybookId?: string;
  error?: string;
}

// Set playbook visibility (AC: 1, 2, 8)
export async function setPlaybookVisibility(
  playbookId: string,
  visibility: PlaybookVisibilityType
): Promise<{ success: boolean; shareToken?: string | null; error?: string }> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  // Validate input
  const validation = setPlaybookVisibilitySchema.safeParse({ playbookId, visibility });
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }

  // Verify ownership
  const playbook = await prisma.playbook.findFirst({
    where: { id: playbookId, userId: user.id },
  });
  if (!playbook) return { success: false, error: 'Playbook not found' };

  // Prepare update data
  const updateData: {
    visibility: PlaybookVisibility;
    shareToken?: string | null;
  } = {
    visibility: visibility as PlaybookVisibility,
  };

  // Generate or clear shareToken based on visibility
  if (visibility === 'UNLISTED') {
    // Generate a new token only if not already set
    if (!playbook.shareToken) {
      updateData.shareToken = crypto.randomUUID();
    }
  } else if (visibility === 'PRIVATE') {
    // Clear the token when going private
    updateData.shareToken = null;
  }
  // For PUBLIC, keep existing token if any (or leave null)

  const updated = await prisma.playbook.update({
    where: { id: playbookId },
    data: updateData,
  });

  revalidatePath('/playbooks');
  return { success: true, shareToken: updated.shareToken };
}

// Get share link for a playbook (AC: 2)
export async function getShareLink(
  playbookId: string
): Promise<{ shareUrl: string | null; visibility: PlaybookVisibilityType }> {
  const user = await getUser();
  if (!user) return { shareUrl: null, visibility: 'PRIVATE' };

  const playbook = await prisma.playbook.findFirst({
    where: { id: playbookId, userId: user.id },
    select: { visibility: true, shareToken: true, id: true },
  });

  if (!playbook) return { shareUrl: null, visibility: 'PRIVATE' };

  const visibility = playbook.visibility as PlaybookVisibilityType;

  if (visibility === 'PRIVATE') {
    return { shareUrl: null, visibility };
  }

  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (visibility === 'UNLISTED' && playbook.shareToken) {
    return {
      shareUrl: `${baseUrl}/playbooks/shared/${playbook.shareToken}`,
      visibility,
    };
  }

  if (visibility === 'PUBLIC') {
    return {
      shareUrl: `${baseUrl}/playbooks/public/${playbook.id}`,
      visibility,
    };
  }

  return { shareUrl: null, visibility };
}

// Get public playbooks for discovery (AC: 3)
export async function getPublicPlaybooks(options?: {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'recent' | 'popular' | 'imports';
}): Promise<PublicPlaybooksResponse> {
  const user = await getUser();

  // Validate and apply defaults
  const validation = getPublicPlaybooksSchema.safeParse(options || {});
  const { search, page, limit, sortBy } = validation.success
    ? validation.data
    : { search: undefined, page: 1, limit: 12, sortBy: 'recent' as const };

  // Build where clause
  const where: {
    visibility: PlaybookVisibility;
    userId?: { not: string };
    OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; description?: { contains: string; mode: 'insensitive' } }>;
  } = {
    visibility: 'PUBLIC',
  };

  // Exclude user's own playbooks if logged in
  if (user) {
    where.userId = { not: user.id };
  }

  // Search filter
  if (search && search.trim()) {
    where.OR = [
      { name: { contains: search.trim(), mode: 'insensitive' } },
      { description: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  // Determine sort order
  const orderBy: Record<string, 'asc' | 'desc'> =
    sortBy === 'popular'
      ? { viewCount: 'desc' }
      : sortBy === 'imports'
        ? { importCount: 'desc' }
        : { createdAt: 'desc' };

  // Get total count
  const total = await prisma.playbook.count({ where });

  // Get playbooks with author info
  const playbooks = await prisma.playbook.findMany({
    where,
    orderBy,
    skip: (page - 1) * limit,
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          discordUsername: true,
        },
      },
      groups: {
        include: {
          prerequisites: {
            select: { id: true },
          },
        },
      },
    },
  });

  // Transform to PublicPlaybook format
  const formattedPlaybooks: PublicPlaybook[] = playbooks.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    author: {
      id: p.user.id,
      displayName: p.user.discordUsername || 'Anonymous Trader',
    },
    groupsCount: p.groups.length,
    prerequisitesCount: p.groups.reduce((sum, g) => sum + g.prerequisites.length, 0),
    importCount: p.importCount,
    createdAt: p.createdAt,
  }));

  return {
    playbooks: formattedPlaybooks,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
}

// Get playbook by share token (AC: 2)
export async function getPlaybookByShareToken(token: string) {
  // Validate token format
  const validation = shareTokenSchema.safeParse({ token });
  if (!validation.success) return null;

  const playbook = await prisma.playbook.findFirst({
    where: {
      shareToken: token,
      visibility: { in: ['UNLISTED', 'PUBLIC'] },
    },
    include: {
      user: {
        select: {
          id: true,
          discordUsername: true,
        },
      },
      groups: {
        include: {
          prerequisites: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!playbook) return null;

  // Increment view count (fire and forget)
  prisma.playbook.update({
    where: { id: playbook.id },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {}); // Ignore errors

  return {
    id: playbook.id,
    name: playbook.name,
    description: playbook.description,
    visibility: playbook.visibility,
    author: {
      id: playbook.user.id,
      displayName: playbook.user.discordUsername || 'Anonymous Trader',
    },
    groups: playbook.groups,
    viewCount: playbook.viewCount,
    importCount: playbook.importCount,
    createdAt: playbook.createdAt,
  };
}

// Get public playbook by ID (AC: 3)
export async function getPublicPlaybook(playbookId: string) {
  const playbook = await prisma.playbook.findFirst({
    where: {
      id: playbookId,
      visibility: 'PUBLIC',
    },
    include: {
      user: {
        select: {
          id: true,
          discordUsername: true,
        },
      },
      groups: {
        include: {
          prerequisites: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!playbook) return null;

  // Increment view count (fire and forget)
  prisma.playbook.update({
    where: { id: playbook.id },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {}); // Ignore errors

  return {
    id: playbook.id,
    name: playbook.name,
    description: playbook.description,
    visibility: playbook.visibility,
    author: {
      id: playbook.user.id,
      displayName: playbook.user.discordUsername || 'Anonymous Trader',
    },
    groups: playbook.groups,
    viewCount: playbook.viewCount,
    importCount: playbook.importCount,
    createdAt: playbook.createdAt,
  };
}

// Import (clone) a shared playbook (AC: 4, 5, 6)
export async function importPlaybook(sourcePlaybookId: string): Promise<ImportResult> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  // Validate input
  const validation = importPlaybookSchema.safeParse({ playbookId: sourcePlaybookId });
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }

  // Find source playbook
  const sourcePlaybook = await prisma.playbook.findFirst({
    where: {
      id: sourcePlaybookId,
      visibility: { in: ['UNLISTED', 'PUBLIC'] },
    },
    include: {
      groups: {
        include: {
          prerequisites: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!sourcePlaybook) {
    return { success: false, error: 'Playbook not found or not shared' };
  }

  // Check if user already imported this playbook
  const existingImport = await prisma.playbook.findFirst({
    where: {
      userId: user.id,
      originalPlaybookId: sourcePlaybookId,
    },
  });

  if (existingImport) {
    return { success: false, error: 'You have already imported this playbook' };
  }

  // Generate unique name
  let importedName = `${sourcePlaybook.name} (imported)`;
  let counter = 1;
  while (true) {
    const existing = await prisma.playbook.findFirst({
      where: { userId: user.id, name: importedName },
    });
    if (!existing) break;
    counter++;
    importedName = `${sourcePlaybook.name} (imported ${counter})`;
  }

  // Clone the playbook in a transaction
  const newPlaybook = await prisma.$transaction(async (tx) => {
    // Create the playbook
    const playbook = await tx.playbook.create({
      data: {
        userId: user.id,
        name: importedName,
        description: sourcePlaybook.description,
        visibility: 'PRIVATE',
        originalPlaybookId: sourcePlaybookId,
        originalAuthorId: sourcePlaybook.userId,
      },
    });

    // Clone groups and prerequisites
    for (const group of sourcePlaybook.groups) {
      const newGroup = await tx.playbookGroup.create({
        data: {
          playbookId: playbook.id,
          name: group.name,
          order: group.order,
        },
      });

      // Clone prerequisites
      if (group.prerequisites.length > 0) {
        await tx.playbookPrerequisite.createMany({
          data: group.prerequisites.map((prereq) => ({
            groupId: newGroup.id,
            text: prereq.text,
            order: prereq.order,
          })),
        });
      }
    }

    // Increment source playbook's import count
    await tx.playbook.update({
      where: { id: sourcePlaybookId },
      data: { importCount: { increment: 1 } },
    });

    return playbook;
  });

  revalidatePath('/playbooks');
  return { success: true, newPlaybookId: newPlaybook.id };
}

// Check if user can import a playbook (helper for UI)
export async function canImportPlaybook(playbookId: string): Promise<{
  canImport: boolean;
  reason?: string;
}> {
  const user = await getUser();
  if (!user) return { canImport: false, reason: 'Not logged in' };

  // Check if already imported
  const existingImport = await prisma.playbook.findFirst({
    where: {
      userId: user.id,
      originalPlaybookId: playbookId,
    },
  });

  if (existingImport) {
    return { canImport: false, reason: 'Already imported' };
  }

  // Check if it's the user's own playbook
  const isOwner = await prisma.playbook.findFirst({
    where: { id: playbookId, userId: user.id },
  });

  if (isOwner) {
    return { canImport: false, reason: 'Cannot import your own playbook' };
  }

  return { canImport: true };
}






