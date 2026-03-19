import { z } from 'zod';

const codeExerciseDataSchema = z.object({
  prompt: z.string().min(1),
  language: z.string().min(1),
  initialCode: z.string(),
  expectedOutput: z.string().min(1),
});

const quizExerciseDataSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).min(2).max(6),
  correctIndex: z.number().min(0),
});

export const createExerciseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('code'),
    data: codeExerciseDataSchema,
  }),
  z.object({
    type: z.literal('quiz'),
    data: quizExerciseDataSchema,
  }),
]);

export const updateExerciseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('code'),
    data: codeExerciseDataSchema.partial(),
  }),
  z.object({
    type: z.literal('quiz'),
    data: quizExerciseDataSchema.partial(),
  }),
]);

export const submitCodeAnswerSchema = z.object({
  type: z.literal('code'),
  code: z.string().min(1),
});

export const submitQuizAnswerSchema = z.object({
  type: z.literal('quiz'),
  answerIndex: z.number().min(0),
});

export const submitAnswerSchema = z.discriminatedUnion('type', [
  submitCodeAnswerSchema,
  submitQuizAnswerSchema,
]);

export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
