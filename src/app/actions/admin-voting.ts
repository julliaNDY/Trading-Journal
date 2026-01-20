'use server';

import prisma from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { VotingOptionStatus, VotingOptionCategory } from '@prisma/client';
import { isAdmin } from './admin';

/**
 * Admin: Get all voting options with vote counts
 */
export async function getAdminVotingOptions() {
  const user = await getUser();
  if (!user || !(await isAdmin())) {
    return { success: false, error: 'Unauthorized', options: [] };
  }

  try {
    const options = await prisma.votingOption.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: {
            votes: true,
          },
        },
        votes: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    const optionsWithVotes = options.map(option => ({
      id: option.id,
      title: option.title,
      description: option.description,
      status: option.status,
      voteCount: option._count.votes,
      votes: option.votes.map(vote => ({
        id: vote.id,
        userId: vote.userId,
        userEmail: vote.user.email,
        createdAt: vote.createdAt,
      })),
      createdAt: option.createdAt,
      updatedAt: option.updatedAt,
    }));

    return { success: true, options: optionsWithVotes };
  } catch (error) {
    console.error('Error fetching admin voting options:', error);
    return { success: false, error: 'Failed to fetch voting options', options: [] };
  }
}

/**
 * Admin: Create voting option
 */
export async function createVotingOption(data: { title: string; description?: string }) {
  const user = await getUser();
  if (!user || !(await isAdmin())) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    if (!data.title || data.title.trim().length === 0) {
      return { success: false, error: 'Title is required' };
    }

    const option = await prisma.votingOption.create({
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        status: VotingOptionStatus.ACTIVE,
        category: VotingOptionCategory.GENERAL, // Admin-created options are always GENERAL
      },
    });

    revalidatePath('/admin');
    revalidatePath('/beta');
    return { success: true, option };
  } catch (error) {
    console.error('Error creating voting option:', error);
    return { success: false, error: 'Failed to create voting option' };
  }
}

/**
 * Admin: Update voting option
 */
export async function updateVotingOption(
  optionId: string,
  data: { title?: string; description?: string; status?: VotingOptionStatus }
) {
  const user = await getUser();
  if (!user || !(await isAdmin())) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const option = await prisma.votingOption.findUnique({
      where: { id: optionId },
    });

    if (!option) {
      return { success: false, error: 'Voting option not found' };
    }

    const updateData: {
      title?: string;
      description?: string | null;
      status?: VotingOptionStatus;
    } = {};

    if (data.title !== undefined) {
      if (data.title.trim().length === 0) {
        return { success: false, error: 'Title is required' };
      }
      updateData.title = data.title.trim();
    }

    if (data.description !== undefined) {
      updateData.description = data.description.trim() || null;
    }

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    const updatedOption = await prisma.votingOption.update({
      where: { id: optionId },
      data: updateData,
    });

    revalidatePath('/admin');
    revalidatePath('/beta');
    return { success: true, option: updatedOption };
  } catch (error) {
    console.error('Error updating voting option:', error);
    return { success: false, error: 'Failed to update voting option' };
  }
}

/**
 * Admin: Delete voting option
 */
export async function deleteVotingOption(optionId: string) {
  const user = await getUser();
  if (!user || !(await isAdmin())) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const option = await prisma.votingOption.findUnique({
      where: { id: optionId },
    });

    if (!option) {
      return { success: false, error: 'Voting option not found' };
    }

    // Delete votes (cascade will handle this, but explicit for clarity)
    await prisma.vote.deleteMany({
      where: { optionId },
    });

    await prisma.votingOption.delete({
      where: { id: optionId },
    });

    revalidatePath('/admin');
    revalidatePath('/beta');
    return { success: true };
  } catch (error) {
    console.error('Error deleting voting option:', error);
    return { success: false, error: 'Failed to delete voting option' };
  }
}

/**
 * Admin: Toggle voting option status
 */
export async function toggleVotingOptionStatus(optionId: string) {
  const user = await getUser();
  if (!user || !(await isAdmin())) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const option = await prisma.votingOption.findUnique({
      where: { id: optionId },
    });

    if (!option) {
      return { success: false, error: 'Voting option not found' };
    }

    const newStatus =
      option.status === VotingOptionStatus.ACTIVE
        ? VotingOptionStatus.INACTIVE
        : VotingOptionStatus.ACTIVE;

    const updatedOption = await prisma.votingOption.update({
      where: { id: optionId },
      data: { status: newStatus },
    });

    revalidatePath('/admin');
    revalidatePath('/beta');
    return { success: true, status: newStatus };
  } catch (error) {
    console.error('Error toggling voting option status:', error);
    return { success: false, error: 'Failed to toggle status' };
  }
}
