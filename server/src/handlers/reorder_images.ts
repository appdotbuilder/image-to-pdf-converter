import { db } from '../db';
import { pdfConversionsTable, imageUploadsTable } from '../db/schema';
import { type ReorderImagesInput, type ImageUpload } from '../schema';
import { eq, and } from 'drizzle-orm';

/**
 * Reorders images within a conversion session by updating their order indices.
 * This handler allows users to change the sequence of images before PDF generation,
 * ensuring the final PDF reflects the desired image order.
 */
export async function reorderImages(input: ReorderImagesInput): Promise<ImageUpload[]> {
  try {
    // 1. Validate that the conversion exists and is in pending status
    const conversion = await db.select()
      .from(pdfConversionsTable)
      .where(eq(pdfConversionsTable.id, input.conversion_id))
      .execute();

    if (conversion.length === 0) {
      throw new Error(`Conversion with ID ${input.conversion_id} not found`);
    }

    if (conversion[0].status !== 'pending') {
      throw new Error(`Cannot reorder images for conversion in ${conversion[0].status} status. Only pending conversions can be modified.`);
    }

    // 2. Get all existing images for this conversion to validate image IDs
    const existingImages = await db.select()
      .from(imageUploadsTable)
      .where(eq(imageUploadsTable.conversion_id, input.conversion_id))
      .execute();

    const existingImageIds = new Set(existingImages.map(img => img.id));

    // Validate that all provided image IDs belong to this conversion
    for (const imageOrder of input.image_orders) {
      if (!existingImageIds.has(imageOrder.image_id)) {
        throw new Error(`Image with ID ${imageOrder.image_id} not found in conversion ${input.conversion_id}`);
      }
    }

    // 3. Check for duplicate order indices
    const orderIndices = input.image_orders.map(order => order.order_index);
    const uniqueOrderIndices = new Set(orderIndices);
    if (orderIndices.length !== uniqueOrderIndices.size) {
      throw new Error('Duplicate order indices are not allowed');
    }

    // 4. Update the order_index for each image in the provided array
    for (const imageOrder of input.image_orders) {
      await db.update(imageUploadsTable)
        .set({ order_index: imageOrder.order_index })
        .where(and(
          eq(imageUploadsTable.id, imageOrder.image_id),
          eq(imageUploadsTable.conversion_id, input.conversion_id)
        ))
        .execute();
    }

    // 5. Return the updated list of images sorted by order_index
    const updatedImages = await db.select()
      .from(imageUploadsTable)
      .where(eq(imageUploadsTable.conversion_id, input.conversion_id))
      .orderBy(imageUploadsTable.order_index)
      .execute();

    return updatedImages;
  } catch (error) {
    console.error('Image reordering failed:', error);
    throw error;
  }
}