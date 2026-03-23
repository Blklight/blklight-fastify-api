import { z } from 'zod';
import { NOTE_COLORS } from '../../config/note-colors';

export const createNoteSchema = z
  .object({
    title: z.string().max(200).nullable().optional(),
    content: z.string().min(1, 'Content is required').max(10000),
    type: z.enum(['text', 'code', 'list']).default('text'),
    language: z.string().max(50).nullable().optional(),
    color: z.enum(NOTE_COLORS).default('yellow'),
  })
  .refine(
    (data) => {
      if (data.type === 'code' && !data.language) {
        return false;
      }
      return true;
    },
    {
      message: 'Language is required when note type is code',
      path: ['language'],
    }
  );

export const updateNoteSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  content: z.string().min(1).max(10000).optional(),
  type: z.enum(['text', 'code', 'list']).optional(),
  language: z.string().max(50).nullable().optional(),
  color: z.enum(NOTE_COLORS).optional(),
});

export const noteQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20).optional(),
  type: z.enum(['text', 'code', 'list']).optional(),
  color: z.enum(NOTE_COLORS).optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type NoteQueryInput = z.infer<typeof noteQuerySchema>;
