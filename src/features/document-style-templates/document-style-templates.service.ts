import { eq, or, isNull } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../../db/index';
import { documentStyleTemplates, NewDocumentStyleTemplate } from './document-style-templates.schema';
import { NotFoundError } from '../../utils/errors';
import type { CreateStyleTemplateInput } from './document-style-templates.zod';

export async function createStyleTemplate(
  authorId: string,
  data: CreateStyleTemplateInput
) {
  const now = new Date();

  const newTemplate: NewDocumentStyleTemplate = {
    id: createId(),
    authorId,
    name: data.name,
    documentType: data.documentType ?? null,
    typography: data.typography,
    paperStyle: data.paperStyle ?? null,
    paperTexture: data.paperTexture ?? null,
    documentHeader: data.documentHeader ?? null,
    documentFooter: data.documentFooter ?? null,
    createdAt: now,
  };

  await db.insert(documentStyleTemplates).values(newTemplate);

  const result = await db
    .select()
    .from(documentStyleTemplates)
    .where(eq(documentStyleTemplates.id, newTemplate.id))
    .limit(1);

  return result[0]!;
}

export async function getMyStyleTemplates(
  authorId: string,
  documentType?: string
) {
  let conditions = [eq(documentStyleTemplates.authorId, authorId)];

  if (documentType) {
    conditions.push(
      or(
        eq(documentStyleTemplates.documentType, documentType),
        isNull(documentStyleTemplates.documentType)
      )!
    );
  }

  return db
    .select()
    .from(documentStyleTemplates)
    .where(or(...conditions))
    .orderBy(documentStyleTemplates.createdAt);
}

export async function deleteStyleTemplate(
  authorId: string,
  templateId: string
): Promise<void> {
  const existing = await db
    .select()
    .from(documentStyleTemplates)
    .where(eq(documentStyleTemplates.id, templateId))
    .limit(1);

  if (existing.length === 0 || existing[0]!.authorId !== authorId) {
    throw new NotFoundError('Template not found');
  }

  await db
    .delete(documentStyleTemplates)
    .where(eq(documentStyleTemplates.id, templateId));
}
