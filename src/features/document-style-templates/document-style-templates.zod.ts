import { z } from 'zod';

export const createStyleTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  documentType: z.string().nullable().optional(),
  typography: z.enum(['sans', 'serif', 'mono']),
  paperStyle: z.record(z.string(), z.unknown()).nullable().optional(),
  paperTexture: z.record(z.string(), z.unknown()).nullable().optional(),
  documentHeader: z.record(z.string(), z.unknown()).nullable().optional(),
  documentFooter: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type CreateStyleTemplateInput = z.infer<typeof createStyleTemplateSchema>;
