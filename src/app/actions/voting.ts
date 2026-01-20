'use server';

import prisma from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { VotingOptionStatus, VotingOptionCategory } from '@prisma/client';

/**
 * Vote on a voting option
 * Rate limiting: 1 vote per user per category (ROADMAP or GENERAL)
 */
export async function voteOnOption(optionId: string) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Check if option exists and is active
    const option = await prisma.votingOption.findUnique({
      where: { id: optionId },
    });

    if (!option) {
      return { success: false, error: 'Voting option not found' };
    }

    if (option.status !== VotingOptionStatus.ACTIVE) {
      return { success: false, error: 'Voting option is not active' };
    }

    // Check if user already voted for this specific option
    const existingVote = await prisma.vote.findUnique({
      where: {
        userId_optionId: {
          userId: user.id,
          optionId: option.id,
        },
      },
    });

    if (existingVote) {
      return { success: false, error: 'You have already voted on this option' };
    }

    // Check if user has already voted in this category (limit: 1 vote per category)
    const userVotesInCategory = await prisma.vote.findMany({
      where: {
        userId: user.id,
        votingOption: {
          category: option.category,
        },
      },
      include: {
        votingOption: {
          select: {
            title: true,
          },
        },
      },
    });

    if (userVotesInCategory.length > 0) {
      const categoryName = option.category === VotingOptionCategory.ROADMAP ? 'roadmap' : 'features';
      const existingOptionTitle = userVotesInCategory[0].votingOption.title;
      return {
        success: false,
        error: `You can only vote for one ${categoryName} option. Please unvote "${existingOptionTitle}" first.`,
      };
    }

    // Create vote (transaction safety)
    await prisma.vote.create({
      data: {
        userId: user.id,
        optionId: option.id,
      },
    });

    revalidatePath('/beta');
    return { success: true };
  } catch (error: any) {
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return { success: false, error: 'You have already voted on this option' };
    }
    console.error('Error voting on option:', error);
    return { success: false, error: 'Failed to vote. Please try again.' };
  }
}

/**
 * Get all voting options with vote counts
 */
export async function getVotingOptions() {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Unauthorized', options: [] };
  }

  try {
    // Only show GENERAL category options in "Vote on Features" tab
    const options = await prisma.votingOption.findMany({
      where: {
        status: VotingOptionStatus.ACTIVE,
        category: VotingOptionCategory.GENERAL, // Only show general voting options
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    // Get user's votes to highlight them
    const userVotes = await prisma.vote.findMany({
      where: {
        userId: user.id,
      },
      select: {
        optionId: true,
      },
    });

    const userVotedOptionIds = new Set(userVotes.map(v => v.optionId));

    const optionsWithVotes = options.map(option => ({
      id: option.id,
      title: option.title,
      description: option.description,
      voteCount: option._count.votes,
      hasUserVoted: userVotedOptionIds.has(option.id),
      createdAt: option.createdAt,
    }));

    return { success: true, options: optionsWithVotes };
  } catch (error) {
    console.error('Error fetching voting options:', error);
    return { success: false, error: 'Failed to fetch voting options', options: [] };
  }
}

/**
 * Remove vote from an option (unvote)
 */
export async function unvoteOption(optionId: string) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    await prisma.vote.delete({
      where: {
        userId_optionId: {
          userId: user.id,
          optionId: optionId,
        },
      },
    });

    revalidatePath('/beta');
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2025') {
      return { success: false, error: 'Vote not found' };
    }
    console.error('Error removing vote:', error);
    return { success: false, error: 'Failed to remove vote. Please try again.' };
  }
}
