import { z } from 'zod';

export const updatePreferencesSchema = z.object({
  timeZone: z.string().optional(),
  campaignUpdate: z.boolean().optional(),
  responseAlerts: z.boolean().optional(),
  influencerActivity: z.boolean().optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export const updateInstagramDemographicsSchema = z.object({
  ageRange: z.array(z.object({
    label: z.string().min(1),
    percentage: z.number().min(0).max(100),
  })).optional(),
  language: z.array(z.object({
    label: z.string().min(1),
    percentage: z.number().min(0).max(100),
  })).optional(),
  gender: z.array(z.object({
    label: z.string().min(1),
    percentage: z.number().min(0).max(100),
  })).optional(),
  primaryLocation: z.array(z.object({
    countryCode: z.string().min(1).max(3),
    countryName: z.string().min(1),
    percentage: z.number().min(0).max(100),
  })).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one demographics field must be provided',
});

export type UpdateInstagramDemographicsInput = z.infer<typeof updateInstagramDemographicsSchema>;
