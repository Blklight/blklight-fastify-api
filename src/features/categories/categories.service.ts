import { eq, and, desc, count } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../../db/index';
import { categories, documentCategories, Category, NewCategory } from './categories.schema';
import { NotFoundError, ValidationError } from '../../utils/errors';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

export interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
  documentCount?: number;
}

/**
 * Create a new category (admin only).
 * @param name - Category name
 * @param description - Optional description
 * @param parentId - Optional parent category ID for hierarchy
 * @returns Created category
 */
export async function createCategory(
  name: string,
  description?: string | null,
  parentId?: string | null
): Promise<Category> {
  const slug = generateSlug(name);

  if (parentId) {
    const [parent] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, parentId))
      .limit(1);

    if (!parent) {
      throw new NotFoundError('Parent category not found');
    }
  }

  const [category] = await db
    .insert(categories)
    .values({
      id: createId(),
      name: name.trim(),
      slug,
      description: description?.trim() ?? null,
      parentId: parentId ?? null,
      createdAt: new Date(),
    })
    .returning();

  return category!;
}

/**
 * Update a category (admin only).
 * @param id - Category ID
 * @param data - Fields to update
 * @returns Updated category
 */
export async function updateCategory(
  id: string,
  data: { name?: string; description?: string | null; parentId?: string | null }
): Promise<Category> {
  const [existing] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Category not found');
  }

  if (data.parentId === id) {
    throw new ValidationError('Category cannot be its own parent');
  }

  if (data.parentId) {
    const [parent] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, data.parentId))
      .limit(1);

    if (!parent) {
      throw new NotFoundError('Parent category not found');
    }
  }

  const slug = data.name ? generateSlug(data.name) : existing.slug;

  const [updated] = await db
    .update(categories)
    .set({
      name: data.name?.trim() ?? existing.name,
      slug,
      description: data.description !== undefined ? data.description?.trim() ?? null : existing.description,
      parentId: data.parentId !== undefined ? data.parentId ?? null : existing.parentId,
    })
    .where(eq(categories.id, id))
    .returning();

  return updated!;
}

/**
 * Delete a category (admin only).
 * Orphaned children get reparented to root.
 * @param id - Category ID
 */
export async function deleteCategory(id: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Category not found');
  }

  await db.transaction(async (tx) => {
    await tx
      .update(categories)
      .set({ parentId: null })
      .where(eq(categories.parentId, id));

    await tx
      .delete(documentCategories)
      .where(eq(documentCategories.categoryId, id));

    await tx
      .delete(categories)
      .where(eq(categories.id, id));
  });
}

/**
 * Get all top-level categories (no parent) with their children tree.
 * @returns Flat list of categories with nested children
 */
export async function getAllCategories(): Promise<CategoryWithChildren[]> {
  const all = await db
    .select()
    .from(categories)
    .orderBy(desc(categories.createdAt));

  const counts = await db
    .select({
      categoryId: documentCategories.categoryId,
      count: count(),
    })
    .from(documentCategories)
    .groupBy(documentCategories.categoryId);

  const countMap = new Map(counts.map((c) => [c.categoryId, Number(c.count)]));

  const map = new Map<string, CategoryWithChildren>();
  for (const cat of all) {
    map.set(cat.id, { ...cat, children: [], documentCount: countMap.get(cat.id) ?? 0 });
  }

  const roots: CategoryWithChildren[] = [];
  for (const cat of all) {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Get a single category by slug.
 * @param slug - Category slug
 * @returns Category with document count
 */
export async function getCategoryBySlug(slug: string): Promise<CategoryWithChildren | null> {
  const [cat] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  if (!cat) {
    return null;
  }

  const [countResult] = await db
    .select({ count: count() })
    .from(documentCategories)
    .where(eq(documentCategories.categoryId, cat.id));

  return {
    ...cat,
    children: [],
    documentCount: Number(countResult?.count ?? 0),
  };
}

/**
 * Assign a category to a document. Replaces existing assignment.
 * @param documentId - Document ID
 * @param categoryId - Category ID
 */
export async function setDocumentCategory(documentId: string, categoryId: string): Promise<void> {
  const [cat] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  if (!cat) {
    throw new NotFoundError('Category not found');
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(documentCategories)
      .where(eq(documentCategories.documentId, documentId));

    await tx.insert(documentCategories).values({
      id: createId(),
      documentId,
      categoryId,
      createdAt: new Date(),
    });
  });
}

/**
 * Remove category assignment from a document.
 * @param documentId - Document ID
 */
export async function removeDocumentCategory(documentId: string): Promise<void> {
  await db
    .delete(documentCategories)
    .where(eq(documentCategories.documentId, documentId));
}

/**
 * Get the category assigned to a document.
 * @param documentId - Document ID
 * @returns Category or null
 */
export async function getDocumentCategory(documentId: string): Promise<Category | null> {
  const [docCat] = await db
    .select({
      id: documentCategories.id,
      documentId: documentCategories.documentId,
      categoryId: documentCategories.categoryId,
      createdAt: documentCategories.createdAt,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      parentId: categories.parentId,
    })
    .from(documentCategories)
    .innerJoin(categories, eq(documentCategories.categoryId, categories.id))
    .where(eq(documentCategories.documentId, documentId))
    .limit(1);

  if (!docCat) {
    return null;
  }

  return {
    id: docCat.categoryId,
    name: docCat.name,
    slug: docCat.slug,
    description: docCat.description,
    parentId: docCat.parentId,
    createdAt: docCat.createdAt,
  };
}
