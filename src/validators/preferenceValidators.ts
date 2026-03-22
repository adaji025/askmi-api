import { z } from 'zod';

export const updatePreferencesSchema = z.object({
  timeZone: z.string().optional(),
  campaignUpdate: z.boolean().optional(),
  responseAlerts: z.boolean().optional(),
  influencerActivity: z.boolean().optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
