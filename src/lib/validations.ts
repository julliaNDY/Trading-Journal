import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

export const tagSchema = z.object({
  name: z.string().min(1, 'Name required').max(50, 'Name too long'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color'),
});

export const dayNoteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  note: z.string().max(10000, 'Note too long'),
});

export const stopLossSchema = z.object({
  tradeId: z.string().min(1),
  stopLossPrice: z.number().positive('Stop loss must be positive').nullable(),
});

export const csvMappingSchema = z.object({
  symbol: z.string().min(1, 'Symbol mapping required'),
  openedAt: z.string().min(1, 'Open date mapping required'),
  closedAt: z.string().min(1, 'Close date mapping required'),
  direction: z.string().optional(),
  entryPrice: z.string().min(1, 'Entry price mapping required'),
  exitPrice: z.string().min(1, 'Exit price mapping required'),
  quantity: z.string().min(1, 'Quantity mapping required'),
  realizedPnlUsd: z.string().min(1, 'PnL mapping required'),
  floatingRunupUsd: z.string().optional(),
  floatingDrawdownUsd: z.string().optional(),
});

// ==================== PLAYBOOK SHARING SCHEMAS ====================

export const playbookVisibilityValues = ['PRIVATE', 'UNLISTED', 'PUBLIC'] as const;
export type PlaybookVisibilityType = typeof playbookVisibilityValues[number];

export const setPlaybookVisibilitySchema = z.object({
  playbookId: z.string().uuid('Invalid playbook ID'),
  visibility: z.enum(playbookVisibilityValues, {
    errorMap: () => ({ message: 'Visibility must be PRIVATE, UNLISTED, or PUBLIC' }),
  }),
});

export const getPublicPlaybooksSchema = z.object({
  search: z.string().max(100, 'Search query too long').optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(12),
  sortBy: z.enum(['recent', 'popular', 'imports']).default('recent'),
});

export const importPlaybookSchema = z.object({
  playbookId: z.string().uuid('Invalid playbook ID'),
});

export const shareTokenSchema = z.object({
  token: z.string().uuid('Invalid share token'),
});

// ==================== TYPE EXPORTS ====================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TagInput = z.infer<typeof tagSchema>;
export type DayNoteInput = z.infer<typeof dayNoteSchema>;
export type StopLossInput = z.infer<typeof stopLossSchema>;
export type CsvMappingInput = z.infer<typeof csvMappingSchema>;
export type SetPlaybookVisibilityInput = z.infer<typeof setPlaybookVisibilitySchema>;
export type GetPublicPlaybooksInput = z.infer<typeof getPublicPlaybooksSchema>;
export type ImportPlaybookInput = z.infer<typeof importPlaybookSchema>;
export type ShareTokenInput = z.infer<typeof shareTokenSchema>;
