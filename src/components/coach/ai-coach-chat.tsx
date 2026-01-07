'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, ThumbsUp, ThumbsDown, Loader2, MessageSquarePlus, History, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { getRecentConversations, getConversation, deleteConversation } from '@/app/actions/coach';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  feedback?: 'LIKE' | 'DISLIKE' | null;
  createdAt: Date;
}

interface AICoachChatProps {
  isOpen: boolean;
  onClose: () => void;
  onNewMessage?: () => void;
}

export function AICoachChat({ isOpen, onClose, onNewMessage }: AICoachChatProps) {
  const t = useTranslations('coach');
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Array<{
    id: string;
    title: string | null;
    updatedAt: Date;
  }>>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Load recent conversations
  const loadConversations = useCallback(async () => {
    const recent = await getRecentConversations(10);
    setConversations(recent.map(c => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
    })));
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  // Load a specific conversation
  const loadConversation = useCallback(async (id: string) => {
    const conv = await getConversation(id);
    if (conv) {
      setConversationId(id);
      setMessages(conv.messages.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        feedback: m.feedback as 'LIKE' | 'DISLIKE' | null,
        createdAt: new Date(m.createdAt),
      })));
      setShowHistory(false);
    }
  }, []);

  // Start new conversation
  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setShowHistory(false);
  }, []);

  // Delete a conversation
  const handleDeleteConversation = useCallback(async (id: string) => {
    const success = await deleteConversation(id);
    if (success) {
      if (conversationId === id) {
        startNewConversation();
      }
      loadConversations();
      toast({
        description: t('conversationDeleted'),
      });
    }
  }, [conversationId, loadConversations, startNewConversation, toast, t]);

  // Send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const response = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send message');
      }

      const data = await response.json();
      
      // Update conversation ID if new
      if (!conversationId) {
        setConversationId(data.conversationId);
      }

      // Replace temp message with real one and add assistant response
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUserMsg.id),
        {
          id: data.userMessage.id,
          role: 'user',
          content: data.userMessage.content,
          createdAt: new Date(data.userMessage.createdAt),
        },
        {
          id: data.assistantMessage.id,
          role: 'assistant',
          content: data.assistantMessage.content,
          createdAt: new Date(data.assistantMessage.createdAt),
        },
      ]);

      onNewMessage?.();
      loadConversations();

    } catch (error) {
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
      
      toast({
        variant: 'destructive',
        title: t('error'),
        description: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, conversationId, onNewMessage, loadConversations, toast, t]);

  // Handle feedback
  const handleFeedback = useCallback(async (messageId: string, feedback: 'LIKE' | 'DISLIKE') => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    // Toggle feedback if same, otherwise set new
    const newFeedback = message.feedback === feedback ? null : feedback;

    // Optimistically update
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, feedback: newFeedback } : m
    ));

    try {
      await fetch('/api/coach/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message',
          messageId,
          feedback: newFeedback,
        }),
      });
    } catch (error) {
      // Revert on error
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, feedback: message.feedback } : m
      ));
    }
  }, [messages]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  if (!isOpen) return null;

  return (
    <div className={cn(
      'fixed bottom-24 right-6 z-50',
      'w-[400px] h-[600px] max-h-[80vh]',
      'bg-background border border-border rounded-2xl shadow-2xl',
      'flex flex-col overflow-hidden',
      'animate-in slide-in-from-bottom-4 fade-in duration-300'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-violet-600/10 to-purple-600/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-600">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">{t('title')}</h3>
            <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowHistory(!showHistory)}
            className="h-8 w-8"
            aria-label={t('history')}
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={startNewConversation}
            className="h-8 w-8"
            aria-label={t('newConversation')}
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="absolute inset-0 top-[60px] bg-background z-10 flex flex-col">
          <div className="p-4 border-b">
            <h4 className="font-medium">{t('recentConversations')}</h4>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {t('noConversations')}
                </p>
              ) : (
                conversations.map(conv => (
                  <div
                    key={conv.id}
                    className={cn(
                      'group flex items-center justify-between p-3 rounded-lg cursor-pointer',
                      'hover:bg-muted/50 transition-colors',
                      conversationId === conv.id && 'bg-muted'
                    )}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {conv.title || t('untitledConversation')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(conv.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conv.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="p-3 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowHistory(false)}
            >
              {t('backToChat')}
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Bot className="h-12 w-12 text-violet-500 mb-4" />
            <h4 className="font-medium mb-2">{t('welcome')}</h4>
            <p className="text-sm text-muted-foreground max-w-[280px]">
              {t('welcomeDescription')}
            </p>
            <div className="mt-6 space-y-2">
              <p className="text-xs text-muted-foreground">{t('suggestions')}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {['analyzeStats', 'improveTips', 'mistakesHelp'].map((key) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setInput(t(`suggestionPrompts.${key}`))}
                  >
                    {t(`suggestionLabels.${key}`)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'flex-row-reverse' : ''
                )}
              >
                <div className={cn(
                  'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
                  message.role === 'user' 
                    ? 'bg-primary' 
                    : 'bg-gradient-to-r from-violet-600 to-purple-600'
                )}>
                  {message.role === 'user' ? (
                    <User className="h-4 w-4 text-primary-foreground" />
                  ) : (
                    <Bot className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className={cn(
                  'flex-1 space-y-1',
                  message.role === 'user' ? 'text-right' : ''
                )}>
                  <div className={cn(
                    'inline-block p-3 rounded-2xl text-sm',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted rounded-tl-sm'
                  )}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-1 mt-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-6 w-6',
                          message.feedback === 'LIKE' && 'text-green-500'
                        )}
                        onClick={() => handleFeedback(message.id, 'LIKE')}
                      >
                        <ThumbsUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-6 w-6',
                          message.feedback === 'DISLIKE' && 'text-red-500'
                        )}
                        onClick={() => handleFeedback(message.id, 'DISLIKE')}
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={t('inputPlaceholder')}
            className="min-h-[44px] max-h-[120px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[44px] w-[44px] flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

