export interface HeadingItem {
  level: number;
  text: string;
  anchor: string;
}

export interface TocItem {
  chapterId: string;
  title: string;
  headings: HeadingItem[];
}

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function extractTextFromNode(node: TipTapNode): string {
  if (node.text) {
    return node.text;
  }
  if (node.content) {
    return node.content.map(extractTextFromNode).join('');
  }
  return '';
}

/**
 * Extract heading nodes from TipTap JSON content.
 * Only extracts headings with level 2, 3, or 4.
 * @param content - TipTap JSON content object
 * @returns Array of heading items with level, text, and anchor
 */
export function extractHeadings(content: TipTapNode | TipTapNode[] | null): HeadingItem[] {
  if (!content) {
    return [];
  }

  const nodes = Array.isArray(content) ? content : [content];
  const headings: HeadingItem[] = [];

  function traverse(node: TipTapNode): void {
    if (node.type === 'heading') {
      const level = (node.attrs?.level as number) ?? 1;
      if (level >= 2 && level <= 4) {
        const text = extractTextFromNode(node);
        if (text) {
          headings.push({
            level,
            text,
            anchor: slugify(text),
          });
        }
      }
    }
    if (node.content) {
      for (const child of node.content) {
        traverse(child);
      }
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return headings;
}

export interface ChapterWithDocument {
  id: string;
  documentId: string;
  position: number;
  introText: string | null;
  outroText: string | null;
  document: {
    id: string;
    title: string;
    content: TipTapNode[] | null;
  };
}

/**
 * Generate table of contents from chapters with their documents.
 * @param chapters - Array of chapters with document data
 * @returns Array of TocItem objects
 */
export function generateToc(chapters: ChapterWithDocument[]): TocItem[] {
  return chapters.map((chapter) => ({
    chapterId: chapter.id,
    title: chapter.document.title,
    headings: extractHeadings(chapter.document.content as TipTapNode[] | null),
  }));
}
