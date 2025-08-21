import { db } from '../db';
import { imageUploadsTable, pdfConversionsTable } from '../db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { unlink } from 'fs/promises';
import path from 'path';

/**
 * Removes an uploaded image from a pending conversion.
 * This handler allows users to delete images they no longer want
 * to include in the final PDF document.
 */
export async function deleteImage(imageId: number): Promise<boolean> {
  try {
    // 1. Validate that the image exists and belongs to a pending conversion
    const imageResult = await db.select({
      id: imageUploadsTable.id,
      file_path: imageUploadsTable.file_path,
      order_index: imageUploadsTable.order_index,
      conversion_id: imageUploadsTable.conversion_id,
      conversion_status: pdfConversionsTable.status
    })
    .from(imageUploadsTable)
    .innerJoin(pdfConversionsTable, eq(imageUploadsTable.conversion_id, pdfConversionsTable.id))
    .where(eq(imageUploadsTable.id, imageId))
    .execute();

    if (imageResult.length === 0) {
      return false; // Image doesn't exist
    }

    const image = imageResult[0];

    // Only allow deletion if conversion is still pending
    if (image.conversion_status !== 'pending') {
      return false; // Cannot delete from non-pending conversion
    }

    // 2. Remove the image file from the filesystem
    try {
      await unlink(image.file_path);
    } catch (fileError) {
      // Log the error but don't fail the operation if file doesn't exist
      console.error('Failed to delete image file:', fileError);
    }

    // 3. Delete the image record from the database
    await db.delete(imageUploadsTable)
      .where(eq(imageUploadsTable.id, imageId))
      .execute();

    // 4. Reorder remaining images to maintain sequential indices
    // Update all images in the same conversion with higher order_index
    await db.update(imageUploadsTable)
      .set({
        order_index: sql`${imageUploadsTable.order_index} - 1`
      })
      .where(
        and(
          eq(imageUploadsTable.conversion_id, image.conversion_id),
          gt(imageUploadsTable.order_index, image.order_index)
        )
      )
      .execute();

    return true;
  } catch (error) {
    console.error('Image deletion failed:', error);
    throw error;
  }
}