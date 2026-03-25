import { describe, it, expect } from 'vitest';
import { extractHeadings, generateToc } from '../../src/utils/toc';

describe('toc', () => {
  describe('extractHeadings', () => {
    it('extractHeadings returns empty array for content with no headings', () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Just a paragraph' }] },
        ],
      };
      const result = extractHeadings(content);
      expect(result).toEqual([]);
    });

    it('extractHeadings extracts h2, h3, h4 correctly', () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Heading 2' }] },
          { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Heading 3' }] },
          { type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'Heading 4' }] },
        ],
      };
      const result = extractHeadings(content);
      expect(result).toHaveLength(3);
      expect(result[0]?.level).toBe(2);
      expect(result[0]?.text).toBe('Heading 2');
      expect(result[1]?.level).toBe(3);
      expect(result[2]?.level).toBe(4);
    });

    it('extractHeadings ignores h1 and h5+', () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'H1' }] },
          { type: 'heading', attrs: { level: 5 }, content: [{ type: 'text', text: 'H5' }] },
          { type: 'heading', attrs: { level: 6 }, content: [{ type: 'text', text: 'H6' }] },
        ],
      };
      const result = extractHeadings(content);
      expect(result).toEqual([]);
    });

    it('extractHeadings generates anchor from heading text (slugified)', () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hello World!' }] },
        ],
      };
      const result = extractHeadings(content);
      expect(result[0]?.anchor).toBe('hello-world');
    });

    it('generateToc returns array with chapter_id, title, headings', () => {
      const chapters = [
        {
          id: 'ch1',
          documentId: 'doc1',
          position: 1,
          introText: null,
          outroText: null,
          document: {
            id: 'doc1',
            title: 'Chapter One',
            content: [
              { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section A' }] },
            ],
          },
        },
      ];
      const result = generateToc(chapters);
      expect(result).toHaveLength(1);
      expect(result[0]?.chapterId).toBe('ch1');
      expect(result[0]?.title).toBe('Chapter One');
      expect(result[0]?.headings).toHaveLength(1);
    });
  });
});
