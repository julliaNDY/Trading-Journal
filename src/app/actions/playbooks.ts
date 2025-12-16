'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { getUser } from '@/lib/auth';

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






