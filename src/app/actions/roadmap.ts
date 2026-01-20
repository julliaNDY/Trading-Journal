'use server';

import { parseRoadmapMarkdown, RoadmapItem, RoadmapSection } from '@/lib/roadmap-parser';
import { getUser } from '@/lib/auth';
import { isAdmin } from './admin';
import prisma from '@/lib/prisma';

/**
 * Get parsed roadmap with vote counts for each epic/phase
 */
export async function getRoadmapWithVotes() {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Unauthorized', sections: [], allItems: [] };
  }

  try {
    const { sections, allItems } = parseRoadmapMarkdown();

    // Get all voting options and their vote counts
    const votingOptions = await prisma.votingOption.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    // Get user's votes
    const userVotes = await prisma.vote.findMany({
      where: {
        userId: user.id,
      },
      select: {
        optionId: true,
      },
    });

    const userVotedOptionIds = new Set(userVotes.map(v => v.optionId));

    // Create a map of roadmap item IDs to voting options
    // Match voting options by title containing epic/phase identifier
    const roadmapItemVoteMap = new Map<string, { voteCount: number; hasUserVoted: boolean; optionId?: string }>();

    for (const item of allItems) {
      // Try to find matching voting option
      const matchingOption = votingOptions.find(option => {
        const optionTitle = option.title.toLowerCase();
        const itemId = item.id.toLowerCase();
        return optionTitle.includes(itemId) || optionTitle.includes(item.title.toLowerCase());
      });

      if (matchingOption) {
        roadmapItemVoteMap.set(item.id, {
          voteCount: matchingOption._count.votes,
          hasUserVoted: userVotedOptionIds.has(matchingOption.id),
          optionId: matchingOption.id,
        });
      } else {
        // No voting option exists yet for this roadmap item
        roadmapItemVoteMap.set(item.id, {
          voteCount: 0,
          hasUserVoted: false,
        });
      }
    }

    // Enrich sections with vote data
    const enrichedSections: (RoadmapSection & { epics: (RoadmapItem & { voteCount: number; hasUserVoted: boolean; optionId?: string })[] })[] =
      sections.map(section => ({
        ...section,
        epics: section.epics.map(epic => {
          const voteData = roadmapItemVoteMap.get(epic.id) || { voteCount: 0, hasUserVoted: false };
          return {
            ...epic,
            voteCount: voteData.voteCount,
            hasUserVoted: voteData.hasUserVoted,
            optionId: voteData.optionId,
          };
        }),
      }));

    return {
      success: true,
      sections: enrichedSections,
      allItems: allItems.map(item => {
        const voteData = roadmapItemVoteMap.get(item.id) || { voteCount: 0, hasUserVoted: false };
        return {
          ...item,
          voteCount: voteData.voteCount,
          hasUserVoted: voteData.hasUserVoted,
          optionId: voteData.optionId,
        };
      }),
    };
  } catch (error) {
    console.error('Error parsing roadmap:', error);
    return { success: false, error: 'Failed to parse roadmap', sections: [], allItems: [] };
  }
}

/**
 * Create or get voting option for a roadmap item
 */
export async function getOrCreateRoadmapVotingOption(roadmapItemId: string, title: string) {
  const user = await getUser();
  if (!user) {
    return { success: false, error: 'Unauthorized', optionId: null };
  }

  try {
    // Check if voting option already exists (search by title containing roadmap item ID)
    const existingOption = await prisma.votingOption.findFirst({
      where: {
        OR: [
          { title: { contains: roadmapItemId } },
          { title: { contains: title.substring(0, 50) } }, // Partial match on title
        ],
      },
    });

    if (existingOption) {
      return { success: true, optionId: existingOption.id };
    }

    // Create new voting option for this roadmap item
    const newOption = await prisma.votingOption.create({
      data: {
        title: `${roadmapItemId}: ${title}`,
        description: `Vote for ${roadmapItemId} to be prioritized in the roadmap. This will help us understand which features matter most to our users.`,
        status: 'ACTIVE',
        category: 'ROADMAP',
      },
    });

    return { success: true, optionId: newOption.id };
  } catch (error) {
    console.error('Error creating roadmap voting option:', error);
    return { success: false, error: 'Failed to create voting option', optionId: null };
  }
}

/**
 * Admin: Get roadmap votes with user details
 */
export async function getAdminRoadmapVotes() {
  const user = await getUser();
  if (!user || !(await isAdmin())) {
    return { success: false, error: 'Unauthorized', roadmapVotes: [] };
  }

  try {
    // #region agent log
    console.log('[DEBUG roadmap.ts:158] Before parseRoadmapMarkdown call', { timestamp: Date.now(), hypothesisId: 'H4' });
    // #endregion
    const { sections, allItems } = parseRoadmapMarkdown();
    // #region agent log
    console.log('[DEBUG roadmap.ts:162] After parseRoadmapMarkdown call', { sectionsCount: sections?.length || 0, allItemsCount: allItems?.length || 0, timestamp: Date.now(), hypothesisId: 'H4' });
    // #endregion

    // Get all voting options that match roadmap items (title contains Epic X or Phase X)
    const votingOptions = await prisma.votingOption.findMany({
      where: {
        OR: [
          { title: { contains: 'Epic' } },
          { title: { contains: 'Phase' } },
        ],
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
                discordUsername: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Map voting options to roadmap items
    // #region agent log
    console.log('[DEBUG roadmap.ts:195] Before filtering allItems', { allItemsType: typeof allItems, isArray: Array.isArray(allItems), allItemsLength: allItems?.length, timestamp: Date.now(), hypothesisId: 'H5' });
    // #endregion
    const roadmapVotes = allItems
      .filter(item => item.type === 'epic') // Only show epics, not phases
      .map(item => {
        // Find matching voting option
        const matchingOption = votingOptions.find(option => {
          const optionTitle = option.title.toLowerCase();
          const itemId = item.id.toLowerCase();
          return optionTitle.includes(itemId) || optionTitle.includes(item.title.toLowerCase());
        });

        return {
          roadmapItem: {
            id: item.id,
            type: item.type,
            title: item.title,
            status: item.status,
            priority: item.priority,
            phase: item.phase,
            epic: item.epic,
            description: item.description,
          },
          votingOption: matchingOption
            ? {
                id: matchingOption.id,
                title: matchingOption.title,
                description: matchingOption.description,
                status: matchingOption.status,
                voteCount: matchingOption._count.votes,
                votes: matchingOption.votes.map(vote => ({
                  id: vote.id,
                  userId: vote.userId,
                  userEmail: vote.user.email,
                  discordUsername: vote.user.discordUsername,
                  createdAt: vote.createdAt,
                })),
                createdAt: matchingOption.createdAt,
              }
            : null,
        };
      })
      .filter(item => item.votingOption !== null && item.votingOption.voteCount > 0); // Only show items with votes

    // Sort by vote count descending
    roadmapVotes.sort((a, b) => {
      const aCount = a.votingOption?.voteCount || 0;
      const bCount = b.votingOption?.voteCount || 0;
      return bCount - aCount;
    });

    return { success: true, roadmapVotes };
  } catch (error) {
    console.error('Error fetching admin roadmap votes:', error);
    return { success: false, error: 'Failed to fetch roadmap votes', roadmapVotes: [] };
  }
}
