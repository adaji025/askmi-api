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
  targetAudience: z.object({
    region: targetAudienceFieldSchema.default({ type: 'all' }),
    city: targetAudienceFieldSchema.default({ type: 'all' }),
    age: targetAudienceFieldSchema.default({ type: 'all' }),
    interest: targetAudienceFieldSchema.default({ type: 'all' }),
  }),
  totalVoteNeeded: z.number().int().positive('Total votes needed must be a positive integer').min(1, 'Total votes needed must be at least 1'),
  numberOfQuestions: z.number().int().min(0, 'Number of questions must be 0 or greater').optional().default(0),
  startDate: z.string().datetime('Start date must be a valid ISO 8601 datetime string').refine((date) => {
    const startDate = new Date(date);
    const now = new Date();
    const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return startDay >= today;
  }, {
    message: 'Start date must be today or in the future',
  }),
  endDate: z.string().datetime('End date must be a valid ISO 8601 datetime string').optional(),
}).refine((data) => {
  if (data.endDate && data.startDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true;
}, {
  message: 'End date must be on or after start date',
  path: ['endDate'],
});
