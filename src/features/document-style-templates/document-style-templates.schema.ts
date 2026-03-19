import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { profiles } from '../profiles/profiles.schema';

export const documentStyleTemplates = pgTable('document_style_templates', {
  id: text('id').primaryKey(),
  authorId: text('author_id').notNull().references(() => profiles.id),
  name: text('name').notNull(),
  documentType: text('document_type'),
  typography: text('typography').notNull(),
  paperStyle: jsonb('paper_style'),
  paperTexture: jsonb('paper_texture'),
  documentHeader: jsonb('document_header'),
  documentFooter: jsonb('document_footer'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type DocumentStyleTemplate = typeof documentStyleTemplates.$inferSelect;
export type NewDocumentStyleTemplate = typeof documentStyleTemplates.$inferInsert;
