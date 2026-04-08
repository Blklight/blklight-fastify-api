/**
 * blklight API - TypeScript Types
 *
 * Version: 1.0.0
 * Description: Complete TypeScript types for the blklight API.
 *              Copy this file to your frontend project for full type safety.
 *
 * Copy Instructions:
 *   - Save as `types/api.types.ts` in your frontend project
 *   - No runtime dependencies - this file is 100% pure TypeScript
 *   - Keep in sync with API changes
 *
 * @see form.schemas.ts for Zod form validation schemas
 *
 * Note on Dates: All date fields are ISO 8601 strings (e.g., "2024-01-15T10:30:00.000Z")
 */

// =============================================================================
// SHARED BASE TYPES
// =============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  message: string;
}

/**
 * API error details
 */
export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

/**
 * Validation error response
 */
export interface ApiValidationError extends ApiError {
  code: 'VALIDATION_ERROR';
  fields: Record<string, string>;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

/**
 * Note and journal colors (Tailwind CSS color names)
 */
export type NoteColor =
  | 'slate'
  | 'gray'
  | 'zinc'
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'fuchsia'
  | 'pink'
  | 'rose';

/**
 * Document status
 */
export type DocumentStatus = 'draft' | 'published' | 'archived';

/**
 * Document types
 */
export type DocumentType = 'article' | 'tutorial' | 'contract' | 'project' | 'page';

/**
 * Note types
 */
export type NoteType = 'text' | 'code' | 'list';

/**
 * Book status
 */
export type BookStatus = 'draft' | 'published';

/**
 * Follow status
 */
export type FollowStatus = 'accepted' | 'pending' | 'rejected' | null;

/**
 * Typography options
 */
export type Typography = 'sans' | 'serif' | 'mono';

/**
 * Exercise types
 */
export type ExerciseType = 'code' | 'quiz';

/**
 * Supported programming languages for exercises
 */
export type SupportedLanguage = 'javascript' | 'typescript';

// =============================================================================
// AUTH TYPES
// =============================================================================

/**
 * POST /api/v1/auth/register
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/v1/auth/register', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     email: 'user@example.com',
 *     username: 'johndoe',
 *     password: 'SecurePass123!'
 *   })
 * });
 * ```
 */
export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

/**
 * POST /api/v1/auth/login
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/v1/auth/login', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     identifier: 'user@example.com', // or username
 *     password: 'SecurePass123!'
 *   })
 * });
 * ```
 */
export interface LoginRequest {
  identifier: string;
  password: string;
}

/**
 * Authentication response
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
}

/**
 * OAuth user (internal)
 */
export interface OAuthUser {
  id: string;
  email: string;
  name: string;
  login?: string;
}

// =============================================================================
// USER TYPES
// =============================================================================

/**
 * User entity (private - not exposed in API responses)
 */
export interface User {
  id: string;
  email: string;
  username: string;
  emailVerified: boolean;
  role: 'user' | 'admin';
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// PROFILE TYPES
// =============================================================================

/**
 * Social links for profiles
 */
export interface SocialLinks {
  twitter?: string;
  github?: string;
  linkedin?: string;
  website?: string;
}

/**
 * Profile entity
 */
export interface Profile {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  bioPrivate: string | null;
  avatarUrl: string | null;
  socialLinks: SocialLinks | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Public profile (minimal info for unauthenticated requests)
 */
export interface ProfilePublic {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  createdAt: string;
}

/**
 * Public profile with extended info (for followers)
 */
export interface ProfileExtended extends ProfilePublic {
  bio: string | null;
  socialLinks: SocialLinks | null;
}

/**
 * PATCH /api/v1/profiles/me
 */
export interface UpdateProfileRequest {
  username?: string;
  displayName?: string | null;
  bio?: string | null;
  bioPrivate?: string | null;
  avatarUrl?: string | null;
  socialLinks?: SocialLinks | null;
  isPrivate?: boolean;
}

// =============================================================================
// DOCUMENT TYPES
// =============================================================================

/**
 * Authorship signature (set on publish, null while draft)
 */
export interface Authorship {
  authorName: string;
  username: string;
  userHash: string;
  documentHash: string;
  publicIdentifier: string;
  hmac: string;
  signedAt: string;
}

/**
 * Document card for feed (summary only, no content)
 */
export interface DocumentCard {
  id: string;
  title: string;
  abstract: string | null;
  coverImageUrl: string | null;
  slug: string;
  status: DocumentStatus;
  typeName: DocumentType;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
  authorship: Authorship | null;
  author: DocumentAuthor;
  likesCount: number;
  category?: CategorySummary;
  tags: TagSummary[];
  likedByMe: boolean | null; // null = unauthenticated
}

/**
 * Document author (minimal profile for document cards)
 */
export interface DocumentAuthor {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Document full response (includes content and exercises)
 */
export interface DocumentFull extends DocumentCard {
  content: Record<string, unknown> | null;
  style: DocumentStyle;
  exercises?: ExerciseSummary[];
}

/**
 * Document style settings
 */
export interface DocumentStyle {
  typography: Typography;
  paperStyle: Record<string, unknown> | null;
  paperTexture: Record<string, unknown> | null;
  coverSettings: Record<string, unknown> | null;
  documentHeader: Record<string, unknown> | null;
  documentFooter: Record<string, unknown> | null;
  documentSignature: Record<string, unknown> | null;
}

/**
 * Exercise summary (returned with document)
 */
export interface ExerciseSummary {
  id: string;
  type: ExerciseType;
  data: ExerciseDataSummary;
}

/**
 * Exercise data for readers (excludes correct answers)
 * Note: correct_index and expected_output are NEVER returned to readers
 */
export type ExerciseDataSummary =
  | {
      type: 'code';
      prompt: string;
      language: SupportedLanguage;
      initialCode: string;
    }
  | {
      type: 'quiz';
      question: string;
      options: string[];
    };

/**
 * Document style template
 */
export interface DocumentStyleTemplate {
  id: string;
  authorId: string;
  name: string;
  documentType: DocumentType | null;
  typography: Typography;
  paperStyle: Record<string, unknown> | null;
  paperTexture: Record<string, unknown> | null;
  documentHeader: Record<string, unknown> | null;
  documentFooter: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * POST /api/v1/documents
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/v1/documents', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${accessToken}`
 *   },
 *   body: JSON.stringify({
 *     title: 'My Article',
 *     type: 'article',
 *     content: { type: 'doc', content: [...] }
 *   })
 * });
 * ```
 */
export interface CreateDocumentRequest {
  title: string;
  abstract?: string | null;
  content?: Record<string, unknown> | null;
  coverImageUrl?: string | null;
  type: DocumentType;
  slug?: string;
  categoryId?: string | null;
  tags?: string[];
}

/**
 * PATCH /api/v1/documents/:id
 */
export interface UpdateDocumentRequest {
  title?: string;
  abstract?: string | null;
  content?: Record<string, unknown> | null;
  coverImageUrl?: string | null;
  type?: DocumentType;
  slug?: string;
  typography?: Typography;
  paperStyle?: Record<string, unknown> | null;
  paperTexture?: Record<string, unknown> | null;
  coverSettings?: Record<string, unknown> | null;
  documentHeader?: Record<string, unknown> | null;
  documentFooter?: Record<string, unknown> | null;
  categoryId?: string | null;
  tags?: string[];
}

/**
 * Feed query parameters
 */
export interface FeedQuery {
  cursor?: string;
  limit?: number;
  type?: DocumentType;
  author?: string;
  q?: string;
  sort?: 'recent' | 'popular';
  category?: string;
  tag?: string;
}

// =============================================================================
// CATEGORY & TAG TYPES
// =============================================================================

/**
 * Category entity
 */
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  createdAt: string;
  children?: Category[];
}

/**
 * Category summary (for document cards)
 */
export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

/**
 * Tag entity
 */
export interface Tag {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

/**
 * Tag summary (for document cards)
 */
export interface TagSummary {
  id: string;
  name: string;
  slug: string;
}

// =============================================================================
// BOOK TYPES
// =============================================================================

/**
 * Book card for feed
 */
export interface BookCard {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  slug: string;
  status: BookStatus;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
  authorship: Authorship | null;
  author: DocumentAuthor;
  chaptersCount: number;
  likesCount: number;
  category?: CategorySummary;
  tags: TagSummary[];
  likedByMe: boolean | null;
}

/**
 * Book chapter
 */
export interface BookChapter {
  id: string;
  bookId: string;
  documentId: string;
  position: number;
  introText: string | null;
  outroText: string | null;
  document: ChapterDocument;
}

/**
 * Chapter document (minimal - title, abstract, slug only)
 */
export interface ChapterDocument {
  id: string;
  title: string;
  abstract: string | null;
  slug: string;
}

/**
 * Table of contents item
 */
export interface TocItem {
  chapterId: string;
  title: string;
  headings: Heading[];
}

/**
 * Heading in TOC
 */
export interface Heading {
  level: number;
  text: string;
  anchor: string;
}

/**
 * Book full response
 */
export interface BookFull extends BookCard {
  description: string | null;
  toc: TocItem[] | null;
  chapters: BookChapter[];
  myProgress?: BookProgress;
}

/**
 * Reading progress
 */
export interface BookProgress {
  lastChapterId: string | null;
  chapterProgress: Record<string, ChapterProgress>;
}

/**
 * Chapter progress
 */
export interface ChapterProgress {
  isRead: boolean;
  readAt: string | null;
}

/**
 * POST /api/v1/books
 */
export interface CreateBookRequest {
  title: string;
  description?: string | null;
  coverImageUrl?: string | null;
  slug?: string;
  categoryId?: string | null;
  tags?: string[];
}

/**
 * PATCH /api/v1/books/:id
 */
export interface UpdateBookRequest {
  title?: string;
  description?: string | null;
  coverImageUrl?: string | null;
  slug?: string;
  categoryId?: string | null;
  tags?: string[];
}

/**
 * POST /api/v1/books/:id/chapters
 */
export interface AddChapterRequest {
  documentId: string;
  position?: number;
  introText?: string | null;
  outroText?: string | null;
}

/**
 * PATCH /api/v1/books/:id/chapters/:chapterId
 */
export interface UpdateChapterRequest {
  introText?: string | null;
  outroText?: string | null;
  position?: number;
}

/**
 * PATCH /api/v1/books/:id/chapters/reorder
 */
export interface ReorderChaptersRequest {
  chapters: { id: string; position: number }[];
}

/**
 * PATCH /api/v1/books/:id/toc
 */
export interface UpdateTocRequest {
  toc: TocItem[];
}

/**
 * Book feed query
 */
export interface BookFeedQuery {
  cursor?: string;
  limit?: number;
  category?: string;
  tag?: string;
  q?: string;
  sort?: 'recent' | 'popular';
}

// =============================================================================
// TUTORIAL EXERCISE TYPES
// =============================================================================

/**
 * Code exercise data (for authors)
 */
export interface CodeExerciseData {
  type: 'code';
  prompt: string;
  language: SupportedLanguage;
  initialCode: string;
  expectedOutput: string;
}

/**
 * Quiz exercise data (for authors)
 */
export interface QuizExerciseData {
  type: 'quiz';
  question: string;
  options: string[];
  correctIndex: number;
}

/**
 * Code exercise data for readers (excludes expectedOutput)
 */
export interface CodeExerciseDataSummary {
  type: 'code';
  prompt: string;
  language: SupportedLanguage;
  initialCode: string;
}

/**
 * Quiz exercise data for readers (excludes correctIndex)
 */
export interface QuizExerciseDataSummary {
  type: 'quiz';
  question: string;
  options: string[];
}

/**
 * Combined exercise data for readers
 * Note: correct_index and expected_output are NEVER returned to readers
 */
export type ExerciseDataSummaryCombined = CodeExerciseDataSummary | QuizExerciseDataSummary;

/**
 * Exercise entity
 */
export interface Exercise {
  id: string;
  documentId: string;
  type: ExerciseType;
  data: CodeExerciseData | QuizExerciseData;
  createdAt: string;
  updatedAt: string;
}

/**
 * Exercise for readers (safe data)
 */
export interface ExerciseSummary {
  id: string;
  type: ExerciseType;
  data: ExerciseDataSummaryCombined;
}

/**
 * POST /api/v1/documents/:id/exercises
 */
export interface CreateExerciseRequest {
  type: 'code';
  data: CodeExerciseData;
}

/**
 * PATCH /api/v1/exercises/:id
 */
export interface UpdateExerciseRequest {
  type: 'code';
  data: Partial<CodeExerciseData>;
}

/**
 * Code submission
 */
export interface CodeSubmission {
  type: 'code';
  code: string;
}

/**
 * Quiz submission
 */
export interface QuizSubmission {
  type: 'quiz';
  answerIndex: number;
}

/**
 * Submit answer request
 */
export type SubmitAnswerRequest = CodeSubmission | QuizSubmission;

/**
 * Submission attempt result
 */
export interface AttemptResult {
  isCorrect: boolean;
  submittedAt: string;
  codeSubmitted: string | null;
}

/**
 * Submission result
 */
export interface SubmissionResult {
  isCorrect: boolean;
  attempts: AttemptResult[];
}

// =============================================================================
// LIKES & BOOKMARKS TYPES
// =============================================================================

/**
 * Toggle like response
 */
export interface ToggleLikeResult {
  liked: boolean;
  likesCount: number;
}

/**
 * Likes response
 */
export interface LikesResponse {
  likesCount: number;
  likedByMe: boolean | null; // null = unauthenticated
}

/**
 * Bookmark result
 */
export interface BookmarkResult {
  bookmarked: boolean;
}

/**
 * Bookmark item
 */
export interface BookmarkItem {
  id: string;
  document: DocumentCard;
  createdAt: string;
}

// =============================================================================
// WORKSPACE & NOTES TYPES
// =============================================================================

/**
 * Color labels for notes
 */
export interface ColorLabels {
  [color: string]: string;
}

/**
 * Workspace entity
 */
export interface Workspace {
  id: string;
  ownerId: string;
  type: 'personal' | 'team';
  name: string;
  isPersonal: boolean;
  colorLabels: ColorLabels | null;
  createdAt: string;
  updatedAt: string;
  stats?: WorkspaceStats;
}

/**
 * Workspace statistics
 */
export interface WorkspaceStats {
  notesCount: number;
  journalsCount: number;
}

/**
 * Note entity
 */
export interface Note {
  id: string;
  workspaceId: string;
  title: string | null;
  content: string;
  type: NoteType;
  language: string | null;
  color: NoteColor;
  createdAt: string;
  updatedAt: string;
}

/**
 * POST /api/v1/notes
 */
export interface CreateNoteRequest {
  title?: string | null;
  content: string;
  type?: NoteType;
  language?: string | null;
  color?: NoteColor;
}

/**
 * PATCH /api/v1/notes/:id
 */
export interface UpdateNoteRequest {
  title?: string | null;
  content?: string;
  type?: NoteType;
  language?: string | null;
  color?: NoteColor;
}

/**
 * Note query parameters
 */
export interface NoteQuery {
  cursor?: string;
  limit?: number;
  type?: NoteType;
  color?: NoteColor;
}

/**
 * PATCH /api/v1/workspace/me/color-labels
 */
export interface UpdateColorLabelsRequest {
  colorLabels: ColorLabels | null;
}

// =============================================================================
// HIGHLIGHTS & JOURNAL TYPES
// =============================================================================

/**
 * Highlight position in document
 */
export interface HighlightPosition {
  nodeIndex: number;
  offsetStart: number;
  offsetEnd: number;
}

/**
 * Highlight selection
 */
export interface HighlightSelection {
  text: string;
  color: string;
  position: HighlightPosition;
}

/**
 * Highlight entity
 */
export interface Highlight {
  id: string;
  userId: string;
  documentId: string;
  selection: HighlightSelection;
  annotation: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Highlight for document view
 */
export interface DocumentHighlight {
  id: string;
  selection: HighlightSelection;
  annotation: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Highlight palette
 */
export interface HighlightPalette {
  colors: string[];
}

/**
 * POST /api/v1/documents/:id/highlights
 */
export interface CreateHighlightRequest {
  documentId: string;
  selection: HighlightSelection;
  annotation?: Record<string, unknown> | null;
}

/**
 * PATCH /api/v1/highlights/:id
 */
export interface UpdateHighlightRequest {
  selection?: HighlightSelection;
  annotation?: Record<string, unknown> | null;
}

/**
 * PATCH /api/v1/highlights/palette
 */
export interface UpdatePaletteRequest {
  colors: string[];
}

/**
 * Highlight grouped by document
 */
export interface HighlightGrouped {
  document: DocumentAuthor & { title: string; slug: string };
  highlights: Highlight[];
}

/**
 * Journal entity
 */
export interface Journal {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  color: NoteColor;
  createdAt: string;
  updatedAt: string;
}

/**
 * Journal with highlights
 */
export interface JournalWithHighlights extends Journal {
  highlights: JournalHighlight[];
}

/**
 * Highlight in a journal
 */
export interface JournalHighlight {
  id: string;
  highlightId: string;
  position: number;
  highlight: Highlight;
}

/**
 * POST /api/v1/journals
 */
export interface CreateJournalRequest {
  title: string;
  description?: string | null;
  color?: NoteColor;
}

/**
 * PATCH /api/v1/journals/:id
 */
export interface UpdateJournalRequest {
  title?: string;
  description?: string | null;
  color?: NoteColor;
}

/**
 * POST /api/v1/journals/:id/highlights
 */
export interface AddHighlightToJournalRequest {
  highlightId: string;
  position?: number;
}

/**
 * PATCH /api/v1/journals/:id/highlights/reorder
 */
export interface ReorderHighlightsRequest {
  highlights: { id: string; position: number }[];
}

// =============================================================================
// FOLLOWS TYPES
// =============================================================================

/**
 * Follow request item
 */
export interface FollowRequest {
  id: string;
  follower: ProfilePublic;
  following: ProfilePublic;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

/**
 * Profile with follow info
 */
export interface ProfileWithFollow extends Profile {
  isFollowing: boolean | null; // null = unauthenticated
  followStatus: FollowStatus;
  followersCount: number;
  followingCount: number;
}

/**
 * Follower/following list item
 */
export interface FollowListItem extends ProfilePublic {
  isFollowing: boolean | null; // null = unauthenticated
  followStatus: FollowStatus;
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'ok';
  uptime: number;
  timestamp: string;
}
