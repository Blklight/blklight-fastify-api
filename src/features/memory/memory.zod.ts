import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;

export const relatedParamsSchema = z.object({
  sourceType: z.enum(['note', 'document', 'journal_highlight', 'book_chapter']),
  sourceId: z.string().min(1),
});

export type RelatedParamsInput = z.infer<typeof relatedParamsSchema>;