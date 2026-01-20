'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Loader2, Vote as VoteIcon } from 'lucide-react';
import { voteOnOption, unvoteOption, getVotingOptions } from '@/app/actions/voting';
import { useToast } from '@/hooks/use-toast';
import { RoadmapVisualization } from '@/components/beta/roadmap-visualization';

interface VotingOption {
  id: string;
  title: string;
  description: string | null;
  voteCount: number;
  hasUserVoted: boolean;
  createdAt: Date;
}

interface BetaContentProps {
  options: VotingOption[];
}

export function BetaContent({ options: initialOptions }: BetaContentProps) {
  const t = useTranslations('beta');
  const locale = useLocale();
  const { toast } = useToast();
  const [options, setOptions] = useState(initialOptions);
  const [loadingOptionId, setLoadingOptionId] = useState<string | null>(null);

  // Translate voting option titles if they match roadmap epics (for locale 'en')
  const translateOptionTitle = (title: string): string => {
    if (locale !== 'en') return title;
    
    // Extract epic ID if present (format: "Epic X: Title" or "Epic X: Title (description)")
    const epicMatch = title.match(/^(Epic \d+): (.+?)(?:\s*\(|$)/);
    if (!epicMatch) return title;

    const epicId = epicMatch[1];
    const epicText = epicMatch[2].trim();
    
    // Map French epic titles to English
    const frenchToEnglish: Record<string, string> = {
      'Multi-Compte Illimité & Broker Sync 240+': 'Unlimited Multi-Account & 240+ Broker Sync',
      'Multi-Compte Illimité': 'Unlimited Multi-Account',
      'Analytics Avancées': 'Advanced Analytics',
      'Replay & Visualisation': 'Replay & Visualization',
      'Journalisation & Partage': 'Journaling & Sharing',
      'Journalisation': 'Journaling',
      'Partage': 'Sharing',
      'Killer Features Inédites': 'Innovative Killer Features',
      'Pages Publiques': 'Public Pages',
      'Infrastructure & Foundation': 'Infrastructure & Foundation', // Already in English
    };

    // Check for exact French text match
    for (const [french, english] of Object.entries(frenchToEnglish)) {
      if (epicText.includes(french)) {
        return `${epicId}: ${epicText.replace(french, english)}`;
      }
    }

    return title;
  };

  const handleVote = async (optionId: string, currentlyVoted: boolean) => {
    setLoadingOptionId(optionId);
    try {
      let result;
      if (currentlyVoted) {
        result = await unvoteOption(optionId);
      } else {
        result = await voteOnOption(optionId);
      }

      if (result.success) {
        // Refresh options
        const refreshResult = await getVotingOptions();
        if (refreshResult.success) {
          setOptions(refreshResult.options);
        }
        toast({
          title: currentlyVoted ? t('voteRemoved') : t('voteRecorded'),
          variant: 'default',
        });
      } else {
        toast({
          title: result.error || t('voteError'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error voting:', error);
      toast({
        title: t('voteError'),
        variant: 'destructive',
      });
    } finally {
      setLoadingOptionId(null);
    }
  };

  const totalVotes = options.reduce((sum, opt) => sum + opt.voteCount, 0);

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'beta-content.tsx:76',message:'beta render locale and header',data:{locale,title:t('title'),description:t('description'),optionsCount:options.length,totalVotes},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('description')}</p>
      </div>

      {/* Voting Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <VoteIcon className="h-5 w-5" />
            {t('voteOnFeatures')}
          </CardTitle>
          <CardDescription>{t('voteDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {options.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('noOptions')}</p>
          ) : (
            options.map((option) => {
              const percentage = totalVotes > 0 ? (option.voteCount / totalVotes) * 100 : 0;
              const isLoading = loadingOptionId === option.id;

              return (
                <Card key={option.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{translateOptionTitle(option.title)}</h3>
                        {option.hasUserVoted && (
                          <Badge variant="default" className="text-xs">
                            {t('youVoted')}
                          </Badge>
                        )}
                      </div>
                      {option.description && (
                        <p className="text-sm text-muted-foreground mb-3">{option.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          {option.voteCount} {option.voteCount === 1 ? t('vote') : t('votes')}
                        </span>
                        {totalVotes > 0 && (
                          <span>
                            {percentage.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      {totalVotes > 0 && (
                        <div className="mt-2 w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => handleVote(option.id, option.hasUserVoted)}
                      disabled={isLoading}
                      variant={option.hasUserVoted ? 'outline' : 'default'}
                      className="shrink-0"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : option.hasUserVoted ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          {t('unvote')}
                        </>
                      ) : (
                        <>
                          <Circle className="h-4 w-4 mr-2" />
                          {t('vote')}
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Roadmap Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>{t('roadmap')}</CardTitle>
          <CardDescription>{t('roadmapDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <RoadmapVisualization />
        </CardContent>
      </Card>
    </div>
  );
}
