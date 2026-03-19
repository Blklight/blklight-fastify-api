import { pgTable, text, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';
import { documents } from '../documents/documents.schema';
import { users } from '../auth/auth.schema';

export const tutorialExercises = pgTable('tutorial_exercises', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => documents.id),
  type: text('type').notNull(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const exerciseSubmissions = pgTable('exercise_submissions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  exerciseId: text('exercise_id').notNull().references(() => tutorialExercises.id),
  attempts: jsonb('attempts').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userExerciseUnique: unique().on(table.userId, table.exerciseId),
}));

export type TutorialExercise = typeof tutorialExercises.$inferSelect;
export type NewTutorialExercise = typeof tutorialExercises.$inferInsert;
export type ExerciseSubmission = typeof exerciseSubmissions.$inferSelect;
export type NewExerciseSubmission = typeof exerciseSubmissions.$inferInsert;
