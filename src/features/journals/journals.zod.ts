import { z } from 'zod';
import { NOTE_COLORS } from '../../config/note-colors';

export const CreateJournalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  color: z.enum(NOTE_COLORS).default('indigo'),
});

export type CreateJournalInput = z.infer<typeof CreateJournalSchema>;

export const UpdateJournalSchema = CreateJournalSchema.partial();

export type UpdateJournalInput = z.infer<typeof UpdateJournalSchema>;

export const AddHighlightSchema = z.object({
  highlightId: z.string(),
  position: z.number().int().positive().optional(),
});

export type AddHighlightInput = z.infer<typeof AddHighlightSchema>;

export const ReorderHighlightItemSchema = z.object({
  id: z.string(),
  position: z.number().int().min(0),
});

export const ReorderHighlightsSchema = z.object({
  highlights: z.array(ReorderHighlightItemSchema),
});

export type ReorderHighlightsInput = z.infer<typeof ReorderHighlightsSchema>;
