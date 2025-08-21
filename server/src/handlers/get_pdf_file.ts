import { db } from '../db';
import { pdfConversionsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { readFile } from 'fs/promises';
import { access, constants } from 'fs/promises';

/**
 * Retrieves the generated PDF file for download or viewing.
 * This handler serves the completed PDF file to the client,
 * typically opening it in a new browser tab as requested.
 */
export async function getPdfFile(conversionId: number): Promise<Buffer | null> {
  try {
    // 1. Validate that the conversion exists and is completed
    const conversions = await db.select()
      .from(pdfConversionsTable)
      .where(eq(pdfConversionsTable.id, conversionId))
      .execute();

    if (conversions.length === 0) {
      return null; // Conversion not found
    }

    const conversion = conversions[0];

    // Check if conversion is completed and has a PDF file path
    if (conversion.status !== 'completed' || !conversion.pdf_file_path) {
      return null; // Conversion not completed or no PDF file path
    }

    // 2. Verify that the PDF file exists on the filesystem
    try {
      await access(conversion.pdf_file_path, constants.F_OK);
    } catch (error) {
      console.error('PDF file does not exist:', conversion.pdf_file_path, error);
      return null; // File doesn't exist
    }

    // 3. Read and return the PDF file as a Buffer for download
    const pdfBuffer = await readFile(conversion.pdf_file_path);
    return pdfBuffer;
  } catch (error) {
    console.error('Failed to retrieve PDF file:', error);
    throw error;
  }
}