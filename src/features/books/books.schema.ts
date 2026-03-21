import { pgTable, text, timestamp, jsonb, integer, boolean, unique } from 'drizzle-orm/pg-core';
import { profiles } from '../profiles/profiles.schema';
import { documents } from '../documents/documents.schema';
import { categories } from '../categories/categories.schema';
import { tags } from '../tags/tags.schema';
import { users } from '../auth/auth.schema';

export const books = pgTable('books', {
  id: text('id').primaryKey(),
  authorId: text('author_id').notNull().references(() => profiles.id),
  status: text('status').default('draft').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  coverImageUrl: text('cover_image_url'),
  slug: text('slug').notNull(),
  toc: jsonb('toc'),
  authorship: jsonb('authorship'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  authorSlugUnique: unique().on(table.authorId, table.slug),
}));

export const bookChapters = pgTable('book_chapters', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull().references(() => books.id),
  documentId: text('document_id').notNull().references(() => documents.id),
  position: integer('position').notNull(),
  introText: text('intro_text'),
  outroText: text('outro_text'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  bookDocumentUnique: unique().on(table.bookId, table.documentId),
  bookPositionUnique: unique().on(table.bookId, table.position),
}));

export const bookCategory = pgTable('book_category', {
  bookId: text('book_id').primaryKey().references(() => books.id),
  categoryId: text('category_id').notNull().references(() => categories.id),
});

export const bookTags = pgTable('book_tags', {
  bookId: text('book_id').notNull().references(() => books.id),
  tagId: text('tag_id').notNull().references(() => tags.id),
}, (table) => ({
  bookTagUnique: unique().on(table.bookId, table.tagId),
}));

export const bookProgress = pgTable('book_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  bookId: text('book_id').notNull().references(() => books.id),
  lastChapterId: text('last_chapter_id').references(() => bookChapters.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userBookUnique: unique().on(table.userId, table.bookId),
}));

export const bookChapterProgress = pgTable('book_chapter_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  chapterId: text('chapter_id').notNull().references(() => bookChapters.id),
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at'),
}, (table) => ({
  userChapterUnique: unique().on(table.userId, table.chapterId),
}));

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type BookChapter = typeof bookChapters.$inferSelect;
export type NewBookChapter = typeof bookChapters.$inferInsert;
export type BookProgress = typeof bookProgress.$inferSelect;
export type NewBookProgress = typeof bookProgress.$inferInsert;
export type BookChapterProgress = typeof bookChapterProgress.$inferSelect;
export type NewBookChapterProgress = typeof bookChapterProgress.$inferInsert;
