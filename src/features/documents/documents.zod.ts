import { z } from 'zod';

export const createDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  abstract: z.string().max(500).nullable().optional(),
  content: z.record(z.string(), z.unknown()).nullable().optional(),
  coverImageUrl: z.string().url('Invalid URL format').nullable().optional(),
  type: z.string().min(1, 'Document type is required'),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').max(100).optional(),
});
export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  abstract: z.string().max(500).nullable().optional(),
  content: z.record(z.string(), z.unknown()).nullable().optional(),
  coverImageUrl: z.string().url('Invalid URL format').nullable().optional(),
  type: z.string().min(1).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').max(100).optional(),
  typography: z.enum(['sans', 'serif', 'mono']).optional(),
  paperStyle: z.record(z.string(), z.unknown()).nullable().optional(),
  paperTexture: z.record(z.string(), z.unknown()).nullable().optional(),
  coverSettings: z.record(z.string(), z.unknown()).nullable().optional(),
  documentHeader: z.record(z.string(), z.unknown()).nullable().optional(),
  documentFooter: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
