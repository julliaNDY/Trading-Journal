'use client';

import { useState } from 'react';
import { MessageSquare, Bug, Lightbulb, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';

type FeedbackCategory = 'SUGGESTION' | 'BUG_REPORT' | 'GENERAL';

interface FeedbackDialogProps {
  trigger?: React.ReactNode;
  defaultCategory?: FeedbackCategory;
}

export function FeedbackDialog({ trigger, defaultCategory = 'SUGGESTION' }: FeedbackDialogProps) {
  const t = useTranslations('feedback');
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>(defaultCategory);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories: { value: FeedbackCategory; label: string; icon: typeof MessageSquare }[] = [
    { value: 'SUGGESTION', label: t('categories.suggestion'), icon: Lightbulb },
    { value: 'BUG_REPORT', label: t('categories.bug'), icon: Bug },
    { value: 'GENERAL', label: t('categories.general'), icon: MessageSquare },
  ];

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/coach/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title: title.trim() || undefined,
          content: content.trim(),
          metadata: {
            page: typeof window !== 'undefined' ? window.location.pathname : undefined,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      toast({
        title: t('success'),
        description: t('successDescription'),
      });

      setOpen(false);
      setTitle('');
      setContent('');
      setCategory(defaultCategory);

    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('errorDescription'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <MessageSquare className="h-4 w-4 mr-2" />
            {t('button')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label>{t('categoryLabel')}</Label>
            <div className="flex gap-2">
              {categories.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  type="button"
                  variant={category === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategory(value)}
                  className={cn(
                    'flex-1',
                    category === value && value === 'SUGGESTION' && 'bg-violet-600 hover:bg-violet-700',
                    category === value && value === 'BUG_REPORT' && 'bg-red-600 hover:bg-red-700',
                    category === value && value === 'GENERAL' && 'bg-blue-600 hover:bg-blue-700'
                  )}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="feedback-title">{t('titleLabel')}</Label>
            <Input
              id="feedback-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              maxLength={100}
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="feedback-content">{t('contentLabel')} *</Label>
            <Textarea
              id="feedback-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('contentPlaceholder')}
              rows={5}
              maxLength={2000}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {content.length}/2000
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {t('submit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

