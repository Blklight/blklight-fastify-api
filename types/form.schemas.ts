/**
 * @file form.schemas.ts
 * @description Zod validation schemas for all frontend forms.
 * Designed for use with react-hook-form + @hookform/resolvers/zod.
 *
 * Companion to types/api.types.ts
 * Backend schemas: src/features/*.zod.ts
 *
 * Error messages use neutral keys for i18n compatibility.
 * Translate them in your i18n config (e.g. en.json, pt-BR.json).
 *
 * @example
 * import { registerSchema, type RegisterFormData } from './form.schemas'
 * import { useForm } from 'react-hook-form'
 * import { zodResolver } from '@hookform/resolvers/zod'
 *
 * const form = useForm<RegisterFormData>({
 *   resolver: zodResolver(registerSchema)
 * })
 *
 * @version 1.0.0
 */

import { z } from "zod";

const NOTE_COLORS = [
  "slate",
  "gray",
  "zinc",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
] as const;

const passwordSchema = z
  .string()
  .min(8, "too_short")
  .refine((pwd) => /[A-Z]/.test(pwd), {
    message: "password_uppercase_required",
  })
  .refine((pwd) => /[0-9]/.test(pwd), {
    message: "password_number_required",
  })
  .refine((pwd) => /[!@#$%^&*]/.test(pwd), {
    message: "password_special_required",
  });

// ============================================================================
// Auth Schemas
// ============================================================================

/**
 * @form Register
 * @route POST /api/v1/auth/register
 * @fields email, username, password, confirmPassword
 */
export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, "required")
      .email("invalid_email")
      .transform((e) => e.toLowerCase().trim()),
    username: z
      .string()
      .min(3, "too_short")
      .max(30, "too_long")
      .regex(/^[a-zA-Z0-9_]+$/, "invalid_format"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "passwords_must_match",
    path: ["confirmPassword"],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * @form Login
 * @route POST /api/v1/auth/login
 * @fields identifier, password
 */
export const loginSchema = z.object({
  identifier: z.string().min(1, "required"),
  password: z.string().min(1, "required"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * @form Onboarding
 * @route POST /api/v1/auth/onboarding
 * @fields username
 */
export const onboardingSchema = z.object({
  username: z
    .string()
    .min(3, "too_short")
    .max(30, "too_long")
    .regex(/^[a-zA-Z0-9_]+$/, "invalid_format"),
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;

/**
 * @form Forgot Password
 * @route POST /api/v1/auth/forgot-password
 * @fields email
 */
export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "required").email("invalid_email"),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/**
 * @form Reset Password
 * @route POST /api/v1/auth/reset-password
 * @fields token, password, confirmPassword
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "required"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "passwords_must_match",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

/**
 * @form Verify Email
 * @route POST /api/v1/auth/verify-email
 * @fields token
 */
export const verifyEmailSchema = z.object({
  token: z.string().min(1, "required"),
});

export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;

// ============================================================================
// Profile Schemas
// ============================================================================

/**
 * @form Update Profile
 * @route PATCH /api/v1/profiles/me
 * @fields username, displayName, bio, bioPrivate, avatarUrl, socialLinks, isPrivate
 */
export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, "too_short")
    .max(30, "too_long")
    .regex(/^[a-zA-Z0-9_]+$/, "invalid_format")
    .optional(),
  displayName: z.string().max(50).nullable().optional(),
  bio: z.string().max(300).nullable().optional(),
  bioPrivate: z.string().max(150).nullable().optional(),
  avatarUrl: z.string().url("invalid_url").nullable().optional(),
  socialLinks: z
    .object({
      twitter: z.string().url("invalid_url").optional(),
      github: z.string().url("invalid_url").optional(),
      linkedin: z.string().url("invalid_url").optional(),
      website: z.string().url("invalid_url").optional(),
    })
    .nullable()
    .optional(),
  isPrivate: z.boolean().optional(),
});

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;

// ============================================================================
// Document Schemas
// ============================================================================

/**
 * @form Create Document
 * @route POST /api/v1/documents
 * @fields title, abstract, type, slug, categoryId, tags
 */
export const createDocumentSchema = z.object({
  title: z.string().min(1, "required").max(200, "too_long"),
  abstract: z.string().max(500, "too_long").nullable().optional(),
  type: z.enum(["article", "tutorial", "contract", "project", "page"], {
    errorMap: () => ({ message: "required" }),
  }),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "invalid_format")
    .max(100, "too_long")
    .optional(),
  categoryId: z.string().nullable().optional(),
  tags: z.array(z.string().min(1).max(30)).max(5, "too_many_items").optional(),
});

export type CreateDocumentFormData = z.infer<typeof createDocumentSchema>;

/**
 * @form Update Document
 * @route PATCH /api/v1/documents/:id
 * @fields title, abstract, type, slug, categoryId, tags, typography, paperStyle, etc.
 */
export const updateDocumentSchema = z.object({
  title: z.string().min(1, "required").max(200, "too_long").optional(),
  abstract: z.string().max(500, "too_long").nullable().optional(),
  type: z
    .enum(["article", "tutorial", "contract", "project", "page"])
    .optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "invalid_format")
    .max(100, "too_long")
    .optional(),
  categoryId: z.string().nullable().optional(),
  tags: z.array(z.string().min(1).max(30)).max(5, "too_many_items").optional(),
  typography: z.enum(["sans", "serif", "mono"]).optional(),
  paperStyle: z.record(z.string(), z.unknown()).nullable().optional(),
  paperTexture: z.record(z.string(), z.unknown()).nullable().optional(),
  coverSettings: z.record(z.string(), z.unknown()).nullable().optional(),
  documentHeader: z.record(z.string(), z.unknown()).nullable().optional(),
  documentFooter: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type UpdateDocumentFormData = z.infer<typeof updateDocumentSchema>;

// ============================================================================
// Category Schemas
// ============================================================================

/**
 * @form Create Category
 * @route POST /api/v1/categories
 * @fields name, description, parentId
 */
export const createCategorySchema = z.object({
  name: z.string().min(1, "required").max(50, "too_long"),
  description: z.string().max(200, "too_long").nullable().optional(),
  parentId: z.string().nullable().optional(),
});

export type CreateCategoryFormData = z.infer<typeof createCategorySchema>;

/**
 * @form Update Category
 * @route PATCH /api/v1/categories/:id
 * @fields name, description, parentId
 */
export const updateCategorySchema = z.object({
  name: z.string().min(1, "required").max(50, "too_long").optional(),
  description: z.string().max(200, "too_long").nullable().optional(),
  parentId: z.string().nullable().optional(),
});

export type UpdateCategoryFormData = z.infer<typeof updateCategorySchema>;

// ============================================================================
// Book Schemas
// ============================================================================

/**
 * @form Create Book
 * @route POST /api/v1/books
 * @fields title, description, coverImageUrl, slug, categoryId, tags
 */
export const createBookSchema = z.object({
  title: z.string().min(1, "required").max(200, "too_long"),
  description: z.string().max(500, "too_long").nullable().optional(),
  coverImageUrl: z.string().url("invalid_url").nullable().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "invalid_format")
    .max(100, "too_long")
    .optional(),
  categoryId: z.string().nullable().optional(),
  tags: z.array(z.string().min(1).max(30)).max(5, "too_many_items").optional(),
});

export type CreateBookFormData = z.infer<typeof createBookSchema>;

/**
 * @form Update Book
 * @route PATCH /api/v1/books/:id
 * @fields title, description, coverImageUrl, slug, categoryId, tags
 */
export const updateBookSchema = z.object({
  title: z.string().min(1, "required").max(200, "too_long").optional(),
  description: z.string().max(500, "too_long").nullable().optional(),
  coverImageUrl: z.string().url("invalid_url").nullable().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "invalid_format")
    .max(100, "too_long")
    .optional(),
  categoryId: z.string().nullable().optional(),
  tags: z.array(z.string().min(1).max(30)).max(5, "too_many_items").optional(),
});

export type UpdateBookFormData = z.infer<typeof updateBookSchema>;

/**
 * @form Add Chapter
 * @route POST /api/v1/books/:id/chapters
 * @fields documentId, position, introText, outroText
 */
export const addChapterSchema = z.object({
  documentId: z.string().min(1, "required"),
  position: z.number().int().min(1).optional(),
  introText: z.string().max(1000, "too_long").nullable().optional(),
  outroText: z.string().max(1000, "too_long").nullable().optional(),
});

export type AddChapterFormData = z.infer<typeof addChapterSchema>;

/**
 * @form Update Chapter
 * @route PATCH /api/v1/books/:id/chapters/:chapterId
 * @fields position, introText, outroText
 */
export const updateChapterSchema = z.object({
  position: z.number().int().min(1).optional(),
  introText: z.string().max(1000, "too_long").nullable().optional(),
  outroText: z.string().max(1000, "too_long").nullable().optional(),
});

export type UpdateChapterFormData = z.infer<typeof updateChapterSchema>;

/**
 * @form Reorder Chapters
 * @route PATCH /api/v1/books/:id/chapters/reorder
 * @fields chapters
 */
export const reorderChaptersSchema = z.object({
  chapters: z
    .array(
      z.object({
        id: z.string().min(1, "required"),
        position: z.number().int().min(1, "too_small"),
      }),
    )
    .min(1, "too_few_items"),
});

export type ReorderChaptersFormData = z.infer<typeof reorderChaptersSchema>;

/**
 * @form Update TOC
 * @route PATCH /api/v1/books/:id/toc
 * @fields toc
 */
export const updateTocSchema = z.object({
  toc: z.array(
    z.object({
      chapterId: z.string().min(1, "required"),
      title: z.string().min(1, "required"),
      headings: z.array(
        z.object({
          level: z.number().int().min(1).max(6),
          text: z.string(),
          anchor: z.string(),
        }),
      ),
    }),
  ),
});

export type UpdateTocFormData = z.infer<typeof updateTocSchema>;

// ============================================================================
// Tutorial Exercise Schemas
// ============================================================================

/**
 * @form Create Code Exercise
 * @route POST /api/v1/documents/:id/exercises
 */
const createCodeExerciseSchema = z.object({
  type: z.literal("code"),
  data: z.object({
    prompt: z.string().min(1, "required"),
    language: z.enum(["javascript", "typescript"], {
      errorMap: () => ({ message: "required" }),
    }),
    initialCode: z.string(),
    expectedOutput: z.string().min(1, "required"),
  }),
});

/**
 * @form Create Quiz Exercise
 * @route POST /api/v1/documents/:id/exercises
 */
const createQuizExerciseSchema = z.object({
  type: z.literal("quiz"),
  data: z.object({
    question: z.string().min(1, "required"),
    options: z.array(z.string().min(1)).min(2).max(6),
    correctIndex: z.number().int().min(0),
  }),
});

export const createExerciseSchema = z.discriminatedUnion("type", [
  createCodeExerciseSchema,
  createQuizExerciseSchema,
]);

export type CreateExerciseFormData = z.infer<typeof createExerciseSchema>;

/**
 * @form Submit Code Answer
 * @route POST /api/v1/exercises/:id/submit
 */
const submitCodeAnswerSchema = z.object({
  type: z.literal("code"),
  code: z.string().min(1, "required"),
});

/**
 * @form Submit Quiz Answer
 * @route POST /api/v1/exercises/:id/submit
 */
const submitQuizAnswerSchema = z.object({
  type: z.literal("quiz"),
  answerIndex: z.number().int().min(0),
});

export const submitAnswerSchema = z.discriminatedUnion("type", [
  submitCodeAnswerSchema,
  submitQuizAnswerSchema,
]);

export type SubmitAnswerFormData = z.infer<typeof submitAnswerSchema>;

// ============================================================================
// Notes Schemas
// ============================================================================

/**
 * @form Create Note
 * @route POST /api/v1/notes
 * @fields title, content, type, language, color
 */
export const createNoteSchema = z
  .object({
    title: z.string().max(200, "too_long").nullable().optional(),
    content: z.string().min(1, "required").max(10000, "too_long"),
    type: z.enum(["text", "code", "list"]).default("text"),
    language: z.string().max(50).nullable().optional(),
    color: z.enum(NOTE_COLORS).default("yellow"),
  })
  .refine(
    (data) => {
      if (data.type === "code" && !data.language) {
        return false;
      }
      return true;
    },
    {
      message: "required",
      path: ["language"],
    },
  );

export type CreateNoteFormData = z.infer<typeof createNoteSchema>;

/**
 * @form Update Note
 * @route PATCH /api/v1/notes/:id
 * @fields title, content, type, language, color
 */
export const updateNoteSchema = z.object({
  title: z.string().max(200, "too_long").nullable().optional(),
  content: z.string().min(1, "required").max(10000, "too_long").optional(),
  type: z.enum(["text", "code", "list"]).optional(),
  language: z.string().max(50).nullable().optional(),
  color: z.enum(NOTE_COLORS).optional(),
});

export type UpdateNoteFormData = z.infer<typeof updateNoteSchema>;

// ============================================================================
// Workspace Schemas
// ============================================================================

/**
 * @form Update Color Labels
 * @route PATCH /api/v1/workspace/me/color-labels
 * @fields colorLabels
 */
export const updateColorLabelsSchema = z
  .object({
    colorLabels: z
      .record(z.enum(NOTE_COLORS), z.string().min(1).max(50))
      .nullable(),
  })
  .refine(
    (data) => {
      if (data.colorLabels === null) return true;
      return Object.keys(data.colorLabels).length <= 20;
    },
    { message: "too_many_items", path: ["colorLabels"] },
  );

export type UpdateColorLabelsFormData = z.infer<typeof updateColorLabelsSchema>;

// ============================================================================
// Highlights Schemas
// ============================================================================

/**
 * @form Create Highlight
 * @route POST /api/v1/documents/:id/highlights
 * @fields documentId, selection, annotation
 */
export const createHighlightSchema = z.object({
  documentId: z.string().min(1, "required"),
  selection: z.object({
    text: z.string().min(1, "required").max(2000, "too_long"),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "invalid_hex_color"),
    position: z.object({
      nodeIndex: z.number().int().min(0),
      offsetStart: z.number().int().min(0),
      offsetEnd: z.number().int().min(1),
    }),
  }),
  annotation: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type CreateHighlightFormData = z.infer<typeof createHighlightSchema>;

/**
 * @form Update Highlight
 * @route PATCH /api/v1/highlights/:id
 * @fields selection, annotation
 */
export const updateHighlightSchema = z.object({
  selection: z
    .object({
      text: z.string().min(1, "required").max(2000, "too_long"),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "invalid_hex_color"),
      position: z.object({
        nodeIndex: z.number().int().min(0),
        offsetStart: z.number().int().min(0),
        offsetEnd: z.number().int().min(1),
      }),
    })
    .optional(),
  annotation: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type UpdateHighlightFormData = z.infer<typeof updateHighlightSchema>;

/**
 * @form Update Highlight Palette
 * @route PATCH /api/v1/highlights/palette
 * @fields colors
 */
export const updatePaletteSchema = z.object({
  colors: z
    .array(z.string().regex(/^#[0-9A-Fa-f]{6}$/, "invalid_hex_color"))
    .length(5, "invalid_palette_length"),
});

export type UpdatePaletteFormData = z.infer<typeof updatePaletteSchema>;

// ============================================================================
// Journal Schemas
// ============================================================================

/**
 * @form Create Journal
 * @route POST /api/v1/journals
 * @fields title, description, color
 */
export const createJournalSchema = z.object({
  title: z.string().min(1, "required").max(200, "too_long"),
  description: z.string().max(500, "too_long").nullable().optional(),
  color: z.enum(NOTE_COLORS).default("indigo"),
});

export type CreateJournalFormData = z.infer<typeof createJournalSchema>;

/**
 * @form Update Journal
 * @route PATCH /api/v1/journals/:id
 * @fields title, description, color
 */
export const updateJournalSchema = z.object({
  title: z.string().min(1, "required").max(200, "too_long").optional(),
  description: z.string().max(500, "too_long").nullable().optional(),
  color: z.enum(NOTE_COLORS).optional(),
});

export type UpdateJournalFormData = z.infer<typeof updateJournalSchema>;

/**
 * @form Add Highlight to Journal
 * @route POST /api/v1/journals/:id/highlights
 * @fields highlightId, position
 */
export const addHighlightToJournalSchema = z.object({
  highlightId: z.string().min(1, "required"),
  position: z.number().int().positive().optional(),
});

export type AddHighlightToJournalFormData = z.infer<
  typeof addHighlightToJournalSchema
>;

/**
 * @form Reorder Journal Highlights
 * @route PATCH /api/v1/journals/:id/highlights/reorder
 * @fields highlights
 */
export const reorderJournalHighlightsSchema = z.object({
  highlights: z
    .array(
      z.object({
        id: z.string().min(1, "required"),
        position: z.number().int().min(0),
      }),
    )
    .min(1, "too_few_items"),
});

export type ReorderJournalHighlightsFormData = z.infer<
  typeof reorderJournalHighlightsSchema
>;
