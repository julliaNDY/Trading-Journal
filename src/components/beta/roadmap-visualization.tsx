'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Circle, CheckCircle2 } from 'lucide-react';
import { getRoadmapWithVotes } from '@/app/actions/roadmap';
import { voteOnOption, unvoteOption } from '@/app/actions/voting';
import { getOrCreateRoadmapVotingOption } from '@/app/actions/roadmap';
import { useToast } from '@/hooks/use-toast';

interface RoadmapItem {
  id: string;
  type: 'epic' | 'phase';
  title: string;
  status: 'upcoming' | 'completed' | 'in_progress';
  priority: 'critique' | 'haute' | 'moyenne' | 'basse' | null;
  phase?: string;
  epic?: string;
  description?: string;
  voteCount: number;
  hasUserVoted: boolean;
  optionId?: string;
}

interface RoadmapSection {
  phaseNumber: string;
  phaseTitle: string;
  phasePriority: 'critique' | 'haute' | 'moyenne' | 'basse' | null;
  phaseStatus: 'upcoming' | 'completed' | 'in_progress';
  epics: RoadmapItem[];
}

/**
 * Roadmap Visualization Component
 * Parses roadmap markdown structure and displays with color-coded statuses
 * 🟠 Upcoming = Orange
 * 🟢 Completed = Green
 * 🔵 In Progress = Blue
 */
export function RoadmapVisualization() {
  const [sections, setSections] = useState<RoadmapSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const { toast } = useToast();
  const locale = useLocale();

  const phaseTitleOverrides: Record<string, string> = {
    'Phase 0': 'Foundation & Planning',
    'Phase 1': 'Foundation & Core Infrastructure',
    'Phase 2': 'Core Features - Data & Connectivity',
    'Phase 3': 'AI & Intelligence',
    'Phase 4': 'Market Replay & Backtesting',
    'Phase 5': 'Advanced Analytics',
    'Phase 6': 'Replay & Visualization',
    'Phase 7': 'Journaling & Sharing',
    'Phase 8': 'Innovative Killer Features',
    'Phase 9': 'Public Pages',
    'Phase 10': 'Community & Engagement',
    'Phase 11': 'AI Daily Bias Analysis',
    'Phase 12': 'Future Roadmap Features',
  };

  const epicTitleOverrides: Record<string, string> = {
    'Epic 1': 'Infrastructure & Foundation',
    'Epic 2': 'Market Replay & Backtesting Infrastructure',
    'Epic 3': 'Unlimited Multi-Account & 240+ Broker Sync',
    'Epic 4': 'AI & Intelligence',
    'Epic 5': 'Advanced Analytics',
    'Epic 6': 'Replay & Visualization',
    'Epic 7': 'Journaling & Sharing',
    'Epic 8': 'Innovative Killer Features',
    'Epic 9': 'Public Pages',
    'Epic 10': 'Beta & Voting System',
    'Epic 11': 'Advanced Admin & User Management',
    'Epic 12': 'AI Daily Bias Analysis',
    'Epic 13': 'Benchmarks & Peer Comparison',
    'Epic 14': 'Video AI Analysis',
    'Epic 15': 'Social Feed & Sharing',
    'Epic 16': 'Mobile App Companion',
    'Epic 17': 'Gamification & Challenges',
  };

  const getPhaseTitle = (section: RoadmapSection) => {
    if (locale === 'en') {
      return phaseTitleOverrides[section.phaseNumber] || section.phaseTitle;
    }
    return section.phaseTitle;
  };

  const getEpicTitle = (item: RoadmapItem) => {
    if (locale === 'en' && item.epic) {
      return epicTitleOverrides[item.epic] || item.title;
    }
    return item.title;
  };

  const loadRoadmap = async () => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'roadmap-visualization.tsx:55',message:'loadRoadmap start',data:{locale},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      const result = await getRoadmapWithVotes();
      if (result.success) {
        setSections(result.sections);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'roadmap-visualization.tsx:60',message:'loadRoadmap success sample',data:{locale,sectionsCount:result.sections.length,firstPhaseTitle:result.sections[0]?.phaseTitle,firstEpicTitle:result.sections[0]?.epics?.[0]?.title},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
      } else {
        console.error('Error loading roadmap:', result.error);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'roadmap-visualization.tsx:64',message:'loadRoadmap error',data:{locale,error:result.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
      }
    } catch (error) {
      console.error('Error loading roadmap:', error);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'roadmap-visualization.tsx:68',message:'loadRoadmap exception',data:{locale},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoadmap();
  }, []);

  const handleVote = async (epic: RoadmapItem) => {
    setLoadingItemId(epic.id);
    try {
      let optionId = epic.optionId;

      // If no voting option exists, create one with translated title
      if (!optionId) {
        const translatedTitle = getEpicTitle(epic);
        const createResult = await getOrCreateRoadmapVotingOption(epic.id, translatedTitle);
        if (!createResult.success || !createResult.optionId) {
          toast({
            title: 'Error',
            description: 'Failed to create voting option',
            variant: 'destructive',
          });
          return;
        }
        optionId = createResult.optionId;
      }

      const currentlyVoted = epic.hasUserVoted;
      let result;

      if (currentlyVoted) {
        result = await unvoteOption(optionId);
      } else {
        result = await voteOnOption(optionId);
      }

      if (result.success) {
        // Reload roadmap to get updated vote counts
        await loadRoadmap();
        toast({
          title: currentlyVoted ? 'Vote removed' : 'Vote recorded',
          variant: 'default',
        });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'roadmap-visualization.tsx:108',message:'vote action success',data:{locale,epicId:epic.id,epicTitle:epic.title,currentlyVoted},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
        // #endregion
      } else {
        toast({
          title: result.error || 'Error voting',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error voting:', error);
      toast({
        title: 'Error voting',
        variant: 'destructive',
      });
    } finally {
      setLoadingItemId(null);
    }
  };

  const getStatusColor = (status: RoadmapItem['status']) => {
    switch (status) {
      case 'upcoming':
        return 'bg-orange-500';
      case 'completed':
        return 'bg-green-500';
      case 'in_progress':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sections.length > 0 && sections[0]?.epics?.length > 0) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'roadmap-visualization.tsx:173',message:'display title sample',data:{locale,phaseDisplay:getPhaseTitle(sections[0]),epicDisplay:getEpicTitle(sections[0].epics[0])},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
  }

  return (
    <div className="space-y-6">
      {sections.map((section, sectionIndex) => (
        <Card key={sectionIndex}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${getStatusColor(section.phaseStatus)} shrink-0`} />
              <CardTitle className="text-lg">
                {section.phaseNumber}: {getPhaseTitle(section)}
              </CardTitle>
            </div>
            <CardDescription>Phase → Epic</CardDescription>
          </CardHeader>
          <CardContent>
            {section.epics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No epics defined for this phase</p>
            ) : (
              <div className="relative ml-3 space-y-4 border-l border-border pl-6">
                {section.epics.map((item, itemIndex) => {
                  const isLoading = loadingItemId === item.id;
                  return (
                    <div key={itemIndex} className="relative">
                      <div className="absolute -left-3 top-3 h-2.5 w-2.5 rounded-full bg-border" />
                      <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className={`h-2.5 w-2.5 rounded-full ${getStatusColor(item.status)} shrink-0`} />
                            <h4 className="font-medium">{item.epic}: {getEpicTitle(item)}</h4>
                            {item.hasUserVoted && (
                              <Badge variant="default" className="text-xs">
                                You voted
                              </Badge>
                            )}
                          </div>
                          {item.description && locale !== 'en' && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>{item.epic}</span>
                            {item.voteCount > 0 && (
                              <span>{item.voteCount} vote{item.voteCount !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleVote(item)}
                          disabled={isLoading || item.status === 'completed'}
                          variant={item.hasUserVoted ? 'outline' : 'default'}
                          size="sm"
                          className="shrink-0"
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : item.hasUserVoted ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Unvote
                            </>
                          ) : (
                            <>
                              <Circle className="h-4 w-4 mr-2" />
                              Vote
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      <div className="text-sm text-muted-foreground text-center py-4">
        <p>Roadmap visualization - Status indicators:</p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span>Upcoming</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>In Progress</span>
          </div>
        </div>
      </div>
    </div>
  );
}
