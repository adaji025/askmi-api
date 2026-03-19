import { z } from 'zod';

export const pricePerUnitVoteSchema = z.object({
  pricePerUnitVote: z.number().positive('Price per unit vote must be a positive number'),
});

export const budgetEstimateParamsSchema = z.object({
  totalQuestions: z.coerce.number().int().min(1, 'Total questions must be at least 1'),
  desiredVote: z.coerce.number().int().min(1, 'Desired vote must be at least 1'),
});

export type PricePerUnitVoteInput = z.infer<typeof pricePerUnitVoteSchema>;
export type BudgetEstimateParams = z.infer<typeof budgetEstimateParamsSchema>;
