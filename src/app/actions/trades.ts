'use server';

import prisma from '@/lib/prisma';
import { getUser } from '@/lib/auth';

// Get all trades with playbooks
export async function getAllTrades() {
  const user = await getUser();
  if (!user) return [];

  const trades = await prisma.trade.findMany({
    where: { userId: user.id },
    include: {
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      },
      screenshots: {
        select: {
          id: true,
          filePath: true,
          originalName: true,
        },
      },
      tradePlaybooks: {
        include: {
          playbook: {
            select: {
              id: true,
              name: true,
            },
          },
          checkedPrerequisites: true,
        },
      },
    },
    orderBy: { closedAt: 'desc' },
  });

  return trades;
}

// Get all playbooks for selection
export async function getPlaybooksForSelection() {
  const user = await getUser();
  if (!user) return [];

  return prisma.playbook.findMany({
    where: { userId: user.id },
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
    orderBy: { name: 'asc' },
  });
}

