import { z } from 'zod';

export const activateAppsSchema = z.object({
  apps: z.array(z.string()).min(1),
});

export type ActivateAppsInput = z.infer<typeof activateAppsSchema>;