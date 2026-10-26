import { describe, it, expect } from 'vitest';
import { generateSlug, resolveUniqueSlug, MAX_SLUG_ATTEMPTS } from '../../src/utils/slug';
import { ConflictError } from '../../src/utils/errors';

describe('generateSlug', () => {
  it('transliterates accented letters instead of dropping them', () => {
    expect(generateSlug('Do rascunho à leitura pública: o ciclo de vida')).toBe(
      'do-rascunho-a-leitura-publica-o-ciclo-de-vida'
    );
    expect(generateSlug('Escrever é voltar ao começo')).toBe('escrever-e-voltar-ao-comeco');
    expect(generateSlug('O primeiro minuto: uma análise')).toBe('o-primeiro-minuto-uma-analise');
  });

  it('maps letters that do not decompose under NFD', () => {
    expect(generateSlug('Ação ç ñ ü straße')).toBe('acao-c-n-u-strasse');
    expect(generateSlug('æøđł')).toBe('aeodl');
  });

  it('lowercases, collapses whitespace and punctuation into single hyphens', () => {
    expect(generateSlug('  Hello   World  ')).toBe('hello-world');
    expect(generateSlug('Café — déjà vu')).toBe('cafe-deja-vu');
  });

  it('keeps the existing result for a symbols-only title', () => {
    expect(generateSlug('!!! ???')).toBe('-');
    expect(generateSlug('★☆♫')).toBe('');
  });

  it('caps the slug at 100 characters', () => {
    expect(generateSlug('a'.repeat(150))).toHaveLength(100);
  });
});

describe('resolveUniqueSlug', () => {
  it('suffixes a taken slug with -1, then -2', async () => {
    const taken = new Set(['repeat-title', 'repeat-title-1']);
    const slug = await resolveUniqueSlug('repeat-title', async (candidate) => taken.has(candidate));
    expect(slug).toBe('repeat-title-2');
  });

  it('returns the base slug when it is free', async () => {
    const slug = await resolveUniqueSlug('free-title', async () => false);
    expect(slug).toBe('free-title');
  });

  it('throws ConflictError after MAX_SLUG_ATTEMPTS collisions', async () => {
    await expect(resolveUniqueSlug('busy', async () => true)).rejects.toBeInstanceOf(ConflictError);
    expect(MAX_SLUG_ATTEMPTS).toBe(20);
  });
});
