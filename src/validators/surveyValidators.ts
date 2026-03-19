import { z } from 'zod';

const questionOptionSchema = z.object({
  id: z.number(),
  text: z.string().min(1, 'Option text is required'),
});

const baseQuestionSchema = z.object({
  type: z.enum(['multiple-choice', 'yes-no', 'rating-scale', 'text']),
  title: z.string().min(1, 'Question title is required'),
  required: z.boolean().default(false),
  id: z.string().min(1, 'Question id is required'),
  order: z.number().int().min(0, 'Order must be a non-negative integer'),
});

const multipleChoiceQuestionSchema = baseQuestionSchema.extend({
  type: z.literal('multiple-choice'),
  options: z.array(questionOptionSchema).min(1, 'Multiple-choice questions must have at least one option'),
});

const yesNoQuestionSchema = baseQuestionSchema.extend({
  type: z.literal('yes-no'),
});

const ratingScaleQuestionSchema = baseQuestionSchema.extend({
  type: z.literal('rating-scale'),
});

const textQuestionSchema = baseQuestionSchema.extend({
  type: z.literal('text'),
});

const questionSchema = z.discriminatedUnion('type', [
  multipleChoiceQuestionSchema,
  yesNoQuestionSchema,
  ratingScaleQuestionSchema,
  textQuestionSchema,
]);

export const createSurveySchema = z.object({
  campaignId: z.string().min(1, 'Campaign ID is required'),
  title: z.string().optional(),
  questions: z.array(questionSchema).min(1, 'At least one question is required'),
});

// Accept raw array as body (transforms to { questions: array }) - requires campaignId in query
export const createSurveyArraySchema = z
  .array(questionSchema)
  .min(1, 'At least one question is required')
  .transform((questions) => ({ questions }));

// Update survey - all fields optional (partial update)
export const updateSurveySchema = z.object({
  title: z.string().optional(),
  questions: z.array(questionSchema).min(1, 'At least one question is required').optional(),
}).refine((data) => data.title !== undefined || data.questions !== undefined, {
  message: 'At least one of title or questions must be provided',
});

export type CreateSurveyInput = z.infer<typeof createSurveySchema>;
