import { z } from 'zod';

export const positionUpdateSchema = z.object({
  noteId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  w: z.number().optional(),
  h: z.number().optional(),
  z: z.number().optional(),
});

export const updatePositionsSchema = z.object({
  positions: z.array(positionUpdateSchema).min(1),
});

export type PositionUpdate = z.infer<typeof positionUpdateSchema>;
export type UpdatePositionsInput = z.infer<typeof updatePositionsSchema>;