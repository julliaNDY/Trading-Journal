'use client';

import { useState, useCallback } from 'react';
import { Bot, X, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AICoachChat } from './ai-coach-chat';
import { useTranslations } from 'next-intl';

interface AICoachButtonProps {
  className?: string;
}

export function AICoachButton({ className }: AICoachButtonProps) {
  const t = useTranslations('coach');
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setHasUnread(false);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <>
      {/* Floating Button */}
      <div className={cn('fixed bottom-6 right-6 z-50', className)}>
        <Button
          onClick={isOpen ? handleClose : handleOpen}
          size="lg"
          className={cn(
            'h-14 w-14 rounded-full shadow-lg transition-all duration-300',
            'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500',
            'hover:scale-110 active:scale-95',
            isOpen && 'rotate-180'
          )}
          aria-label={isOpen ? t('close') : t('open')}
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <div className="relative">
              <Bot className="h-6 w-6" />
              {hasUnread && (
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 animate-pulse" />
              )}
            </div>
          )}
        </Button>

        {/* Tooltip when closed */}
        {!isOpen && (
          <div className="absolute bottom-full right-0 mb-2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
              <div className="flex items-center gap-2 text-sm">
                <MessageCircle className="h-4 w-4 text-violet-500" />
                <span>{t('tooltip')}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Panel */}
      <AICoachChat 
        isOpen={isOpen} 
        onClose={handleClose}
        onNewMessage={() => !isOpen && setHasUnread(true)}
      />
    </>
  );
}

