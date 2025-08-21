import { db } from '../db';
import { pdfConversionsTable } from '../db/schema';
import { type CreateConversionInput, type PdfConversion } from '../schema';

/**
 * Creates a new PDF conversion session with specified page settings.
 * This handler initializes a conversion with the given page size and orientation,
 * setting the initial status to 'pending'. Users can then upload images to this conversion.
 */
export async function createConversion(input: CreateConversionInput): Promise<PdfConversion> {
  try {
    // Insert new PDF conversion record with pending status
    const result = await db.insert(pdfConversionsTable)
      .values({
        page_size: input.page_size,
        orientation: input.orientation,
        status: 'pending',
        pdf_file_path: null,
        error_message: null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Conversion creation failed:', error);
    throw error;
  }
}