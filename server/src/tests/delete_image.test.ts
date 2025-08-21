import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { imageUploadsTable, pdfConversionsTable } from '../db/schema';
import { deleteImage } from '../handlers/delete_image';
import { eq } from 'drizzle-orm';
import { writeFile, mkdir, access, unlink } from 'fs/promises';
import path from 'path';

// Test data setup
const createTestConversion = async (status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending') => {
  const result = await db.insert(pdfConversionsTable)
    .values({
      page_size: 'a4',
      orientation: 'portrait',
      status
    })
    .returning()
    .execute();
  return result[0];
};

const createTestImage = async (conversionId: number, orderIndex: number, fileName = 'test.jpg') => {
  // Create test file directory
  const testDir = path.join(process.cwd(), 'test-uploads');
  await mkdir(testDir, { recursive: true });
  
  const filePath = path.join(testDir, fileName);
  await writeFile(filePath, 'test image content');
  
  const result = await db.insert(imageUploadsTable)
    .values({
      original_name: fileName,
      file_path: filePath,
      file_size: 1024,
      format: 'jpeg',
      order_index: orderIndex,
      conversion_id: conversionId
    })
    .returning()
    .execute();
  
  return result[0];
};

const cleanupTestFiles = async () => {
  const testDir = path.join(process.cwd(), 'test-uploads');
  try {
    // Try to remove test directory and all its contents
    await unlink(testDir).catch(() => {}); // Ignore errors
  } catch {
    // Directory cleanup failed, ignore
  }
};

describe('deleteImage', () => {
  beforeEach(createDB);
  afterEach(async () => {
    await cleanupTestFiles();
    await resetDB();
  });

  it('should delete an image from a pending conversion', async () => {
    const conversion = await createTestConversion('pending');
    const image = await createTestImage(conversion.id, 0, 'test1.jpg');

    const result = await deleteImage(image.id);

    expect(result).toBe(true);

    // Verify image was deleted from database
    const images = await db.select()
      .from(imageUploadsTable)
      .where(eq(imageUploadsTable.id, image.id))
      .execute();

    expect(images).toHaveLength(0);
  });

  it('should return false for non-existent image', async () => {
    const result = await deleteImage(99999);

    expect(result).toBe(false);
  });

  it('should return false for images in non-pending conversions', async () => {
    const completedConversion = await createTestConversion('completed');
    const image = await createTestImage(completedConversion.id, 0, 'completed.jpg');

    const result = await deleteImage(image.id);

    expect(result).toBe(false);

    // Verify image was NOT deleted
    const images = await db.select()
      .from(imageUploadsTable)
      .where(eq(imageUploadsTable.id, image.id))
      .execute();

    expect(images).toHaveLength(1);
  });

  it('should return false for images in processing conversions', async () => {
    const processingConversion = await createTestConversion('processing');
    const image = await createTestImage(processingConversion.id, 0, 'processing.jpg');

    const result = await deleteImage(image.id);

    expect(result).toBe(false);

    // Verify image was NOT deleted
    const images = await db.select()
      .from(imageUploadsTable)
      .where(eq(imageUploadsTable.id, image.id))
      .execute();

    expect(images).toHaveLength(1);
  });

  it('should reorder remaining images after deletion', async () => {
    const conversion = await createTestConversion('pending');
    
    // Create multiple images with sequential order indices
    const image1 = await createTestImage(conversion.id, 0, 'image1.jpg');
    const image2 = await createTestImage(conversion.id, 1, 'image2.jpg');
    const image3 = await createTestImage(conversion.id, 2, 'image3.jpg');
    const image4 = await createTestImage(conversion.id, 3, 'image4.jpg');

    // Delete the middle image (order_index = 1)
    const result = await deleteImage(image2.id);

    expect(result).toBe(true);

    // Verify remaining images have correct order indices
    const remainingImages = await db.select()
      .from(imageUploadsTable)
      .where(eq(imageUploadsTable.conversion_id, conversion.id))
      .orderBy(imageUploadsTable.order_index)
      .execute();

    expect(remainingImages).toHaveLength(3);
    
    // Check that order indices are now 0, 1, 2 (sequential)
    expect(remainingImages[0].id).toBe(image1.id);
    expect(remainingImages[0].order_index).toBe(0);
    
    expect(remainingImages[1].id).toBe(image3.id);
    expect(remainingImages[1].order_index).toBe(1); // Was 2, now 1
    
    expect(remainingImages[2].id).toBe(image4.id);
    expect(remainingImages[2].order_index).toBe(2); // Was 3, now 2
  });

  it('should handle deletion of first image correctly', async () => {
    const conversion = await createTestConversion('pending');
    
    const image1 = await createTestImage(conversion.id, 0, 'first.jpg');
    const image2 = await createTestImage(conversion.id, 1, 'second.jpg');
    const image3 = await createTestImage(conversion.id, 2, 'third.jpg');

    // Delete the first image
    const result = await deleteImage(image1.id);

    expect(result).toBe(true);

    // Verify remaining images are reordered correctly
    const remainingImages = await db.select()
      .from(imageUploadsTable)
      .where(eq(imageUploadsTable.conversion_id, conversion.id))
      .orderBy(imageUploadsTable.order_index)
      .execute();

    expect(remainingImages).toHaveLength(2);
    expect(remainingImages[0].id).toBe(image2.id);
    expect(remainingImages[0].order_index).toBe(0); // Was 1, now 0
    expect(remainingImages[1].id).toBe(image3.id);
    expect(remainingImages[1].order_index).toBe(1); // Was 2, now 1
  });

  it('should handle deletion of last image correctly', async () => {
    const conversion = await createTestConversion('pending');
    
    const image1 = await createTestImage(conversion.id, 0, 'first.jpg');
    const image2 = await createTestImage(conversion.id, 1, 'second.jpg');
    const image3 = await createTestImage(conversion.id, 2, 'last.jpg');

    // Delete the last image
    const result = await deleteImage(image3.id);

    expect(result).toBe(true);

    // Verify remaining images maintain their order
    const remainingImages = await db.select()
      .from(imageUploadsTable)
      .where(eq(imageUploadsTable.conversion_id, conversion.id))
      .orderBy(imageUploadsTable.order_index)
      .execute();

    expect(remainingImages).toHaveLength(2);
    expect(remainingImages[0].id).toBe(image1.id);
    expect(remainingImages[0].order_index).toBe(0);
    expect(remainingImages[1].id).toBe(image2.id);
    expect(remainingImages[1].order_index).toBe(1);
  });

  it('should handle single image deletion', async () => {
    const conversion = await createTestConversion('pending');
    const image = await createTestImage(conversion.id, 0, 'only.jpg');

    const result = await deleteImage(image.id);

    expect(result).toBe(true);

    // Verify no images remain
    const remainingImages = await db.select()
      .from(imageUploadsTable)
      .where(eq(imageUploadsTable.conversion_id, conversion.id))
      .execute();

    expect(remainingImages).toHaveLength(0);
  });

  it('should not affect images from other conversions', async () => {
    const conversion1 = await createTestConversion('pending');
    const conversion2 = await createTestConversion('pending');
    
    const image1 = await createTestImage(conversion1.id, 0, 'conv1.jpg');
    const image2 = await createTestImage(conversion2.id, 0, 'conv2.jpg');

    const result = await deleteImage(image1.id);

    expect(result).toBe(true);

    // Verify image from conversion2 is unaffected
    const conv2Images = await db.select()
      .from(imageUploadsTable)
      .where(eq(imageUploadsTable.conversion_id, conversion2.id))
      .execute();

    expect(conv2Images).toHaveLength(1);
    expect(conv2Images[0].id).toBe(image2.id);
    expect(conv2Images[0].order_index).toBe(0);
  });
});