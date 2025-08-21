import { db } from '../db';
import { pdfConversionsTable } from '../db/schema';
import { type UpdateConversionInput, type PdfConversion } from '../schema';
import { eq, and } from 'drizzle-orm';

/**
 * Updates the page settings (size and orientation) for a pending conversion.
 * This handler allows users to modify the PDF configuration before processing
 * the images into a final PDF document.
 */
export async function updateConversion(input: UpdateConversionInput): Promise<PdfConversion> {
  try {
    // First, verify the conversion exists and is in pending status
    const existingConversion = await db.select()
      .from(pdfConversionsTable)
      .where(eq(pdfConversionsTable.id, input.id))
      .execute();

    if (existingConversion.length === 0) {
      throw new Error(`Conversion with ID ${input.id} not found`);
    }

    const conversion = existingConversion[0];

    // Only allow updates to pending conversions
    if (conversion.status !== 'pending') {
      throw new Error(`Cannot update conversion with status: ${conversion.status}. Only pending conversions can be updated.`);
    }

    // Build update object with only provided fields
    const updateFields: Partial<typeof pdfConversionsTable.$inferInsert> = {};
    
    if (input.page_size !== undefined) {
      updateFields.page_size = input.page_size;
    }
    
    if (input.orientation !== undefined) {
      updateFields.orientation = input.orientation;
    }

    // If no fields to update, return existing conversion
    if (Object.keys(updateFields).length === 0) {
      return conversion;
    }

    // Update the conversion
    const result = await db.update(pdfConversionsTable)
      .set(updateFields)
      .where(eq(pdfConversionsTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Conversion update failed:', error);
    throw error;
  }
}