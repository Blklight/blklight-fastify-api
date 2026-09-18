import { ConflictError } from './errors';

export const MAX_SLUG_ATTEMPTS = 20;

/**
 * Normalize a free-text name/title into a URL-safe slug.
 * Shared across features that used to copy this logic per-service.
 */
export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

/**
 * Find a slug that is not taken by appending an increasing numeric suffix
 * (`slug`, `slug-1`, `slug-2`, ...). Bounded to MAX_SLUG_ATTEMPTS so a
 * pathological collision set throws instead of looping forever.
 * @param slug - The base slug to make unique
 * @param isTaken - Predicate that checks whether a candidate slug is in use
 * @returns A unique slug
 * @throws ConflictError if every candidate up to the cap is already taken
 */
export async function resolveUniqueSlug(
  slug: string,
  isTaken: (candidate: string) => Promise<boolean>
): Promise<string> {
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }
  throw new ConflictError(
    `Could not generate a unique slug for "${slug}" after ${MAX_SLUG_ATTEMPTS} attempts`
  );
}