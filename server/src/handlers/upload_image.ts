import { db } from '../db';
import { imageUploadsTable, pdfConversionsTable } from '../db/schema';
import { type UploadImageInput, type ImageUpload } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Uploads an image file to a specific conversion session.
 * This handler processes the uploaded image file, stores it in the filesystem,
 * and records the image metadata in the database with the specified order index.
 */
export async function uploadImage(input: UploadImageInput): Promise<ImageUpload> {
  try {
    // 1. Validate that the conversion exists and is in pending status
    const conversions = await db.select()
      .from(pdfConversionsTable)
      .where(eq(pdfConversionsTable.id, input.conversion_id))
      .execute();

    if (conversions.length === 0) {
      throw new Error(`Conversion with ID ${input.conversion_id} not found`);
    }

    const conversion = conversions[0];
    if (conversion.status !== 'pending') {
      throw new Error(`Cannot upload images to conversion with status: ${conversion.status}`);
    }

    // 2. Save image metadata to the database with the conversion reference
    const result = await db.insert(imageUploadsTable)
      .values({
        original_name: input.original_name,
        file_path: input.file_path,
        file_size: input.file_size,
        format: input.format,
        order_index: input.order_index,
        conversion_id: input.conversion_id
      })
      .returning()
      .execute();

    // 3. Return the created image upload record
    return result[0];
  } catch (error) {
    console.error('Image upload failed:', error);
    throw error;
  }
}