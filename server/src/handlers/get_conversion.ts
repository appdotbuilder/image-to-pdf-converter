import { db } from '../db';
import { pdfConversionsTable, imageUploadsTable } from '../db/schema';
import { type ConversionWithImages } from '../schema';
import { eq, asc } from 'drizzle-orm';

/**
 * Retrieves a conversion record along with all its associated images.
 * This handler provides complete information about a conversion session,
 * including the current status, settings, and all uploaded images in order.
 */
export async function getConversion(conversionId: number): Promise<ConversionWithImages | null> {
  try {
    // Query conversion with all associated images in a single query
    const results = await db.select()
      .from(pdfConversionsTable)
      .leftJoin(imageUploadsTable, eq(pdfConversionsTable.id, imageUploadsTable.conversion_id))
      .where(eq(pdfConversionsTable.id, conversionId))
      .orderBy(asc(imageUploadsTable.order_index))
      .execute();

    // If no results, conversion doesn't exist
    if (results.length === 0) {
      return null;
    }

    // Extract conversion data from the first result
    const conversionData = results[0].pdf_conversions;

    // Collect all images, filtering out null entries (from left join)
    const images = results
      .map(result => result.image_uploads)
      .filter(image => image !== null)
      .map(image => ({
        ...image,
        file_size: image.file_size, // Integer column - no conversion needed
        order_index: image.order_index, // Integer column - no conversion needed
        conversion_id: image.conversion_id, // Integer column - no conversion needed
      }));

    // Return the complete conversion with images
    return {
      ...conversionData,
      images
    };
  } catch (error) {
    console.error('Get conversion failed:', error);
    throw error;
  }
}