import { ConflictError } from './errors';

export const MAX_SLUG_ATTEMPTS = 20;

/**
 * Letters that do not decompose under NFD, so the diacritic strip alone would
 * erase them. Lowercased before the lookup because the input is lowercased
 * first.
 */
const SPECIAL_LETTERS: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  ø: 'o',
  đ: 'd',
  ł: 'l',
};

/**
 * Normalize a free-text name/title into a URL-safe slug.
 * Shared across features that used to copy this logic per-service.
 *
 * Accents are transliterated, not dropped: NFD splits "á" into "a" plus a
 * combining mark, the marks are removed, and letters that do not decompose
 * (ß, æ, ø, đ, ł) go through an explicit map. Dropping them instead would
 * turn "pública" into "pblica".
 */
export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[ßæøđł]/g, (letter) => SPECIAL_LETTERS[letter] ?? letter)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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