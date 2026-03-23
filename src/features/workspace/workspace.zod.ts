import { z } from 'zod';
import { NOTE_COLORS } from '../../config/note-colors';

export const updateColorLabelsSchema = z.union([
  z.object({
    colorLabels: z.record(z.enum(NOTE_COLORS), z.string().min(1).max(50)),
  }),
  z.object({
    colorLabels: z.literal(null),
  }),
]).refine(
  (data) => {
    if (data.colorLabels === null) return true;
    return Object.keys(data.colorLabels).length <= 20;
  },
  { message: 'Maximum 20 color labels allowed', path: ['colorLabels'] }
);

export type UpdateColorLabelsInput = z.infer<typeof updateColorLabelsSchema>;
