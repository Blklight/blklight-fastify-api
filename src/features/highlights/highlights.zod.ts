import { z } from 'zod';

export const positionSchema = z.object({
  nodeIndex: z.number().int().min(0),
  offsetStart: z.number().int().min(0),
  offsetEnd: z.number().int().min(1),
});

export const selectionSchema = z.object({
  text: z.string().min(1, 'Highlighted text is required').max(2000),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
  position: positionSchema,
});

export const createHighlightSchema = z.object({
  documentId: z.string().cuid2(),
  selection: selectionSchema,
  annotation: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const updateHighlightSchema = z.object({
  selection: selectionSchema.optional(),
  annotation: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const updatePaletteSchema = z.object({
  colors: z
    .array(z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'))
    .length(5, 'Palette must have exactly 5 colors'),
});

export const highlightQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20).optional(),
});

export type CreateHighlightInput = z.infer<typeof createHighlightSchema>;
export type UpdateHighlightInput = z.infer<typeof updateHighlightSchema>;
export type UpdatePaletteInput = z.infer<typeof updatePaletteSchema>;
export type HighlightQueryInput = z.infer<typeof highlightQuerySchema>;
