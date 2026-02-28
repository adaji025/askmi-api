import { z } from 'zod';

// Target audience field schema
const targetAudienceFieldSchema = z.object({
  type: z.enum(['all', 'custom']),
  values: z.array(z.string()).optional(),
}).refine((data) => {
  // If type is "custom", values must be provided and non-empty
  if (data.type === 'custom') {
    return data.values !== undefined && data.values.length > 0;
  }
  return true;
}, {
  message: 'Values array is required and must not be empty when type is "custom"',
  path: ['values'],
});

// Campaign creation validation schema
export const createCampaignSchema = z.object({
  campaignName: z.string().min(2, 'Campaign name must be at least 2 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  surveySource: z.enum(['creating_new', 'use_existing_survey']),
  surveyId: z.string().optional(),
  targetAudience: z.object({
    region: targetAudienceFieldSchema,
    city: targetAudienceFieldSchema,
    age: targetAudienceFieldSchema,
    interest: targetAudienceFieldSchema,
  }),
  totalVoteNeeded: z.number().int().positive('Total votes needed must be a positive integer').min(1, 'Total votes needed must be at least 1'),
  startDate: z.string().datetime('Start date must be a valid ISO 8601 datetime string').refine((date) => {
    const startDate = new Date(date);
    const now = new Date();
    return startDate > now;
  }, {
    message: 'Start date must be in the future',
  }),
}).refine((data) => {
  // If surveySource is "use_existing_survey", surveyId must be provided
  if (data.surveySource === 'use_existing_survey') {
    return data.surveyId !== undefined && data.surveyId.length > 0;
  }
  return true;
}, {
  message: 'Survey ID is required when survey source is "use_existing_survey"',
  path: ['surveyId'],
});
