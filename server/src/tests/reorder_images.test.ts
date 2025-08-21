import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { pdfConversionsTable, imageUploadsTable } from '../db/schema';
import { type ReorderImagesInput, type CreateConversionInput, type UploadImageInput } from '../schema';
import { reorderImages } from '../handlers/reorder_images';
import { eq } from 'drizzle-orm';

describe('reorderImages', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testConversionId: number;
  let testImages: number[];

  // Setup helper to create a conversion and images for testing
  const createTestConversionWithImages = async () => {
    // Create a test conversion
    const conversionInput: CreateConversionInput = {
      page_size: 'a4',
      orientation: 'portrait'
    };

    const [conversion] = await db.insert(pdfConversionsTable)
      .values({
        page_size: conversionInput.page_size,
        orientation: conversionInput.orientation,
        status: 'pending'
      })
      .returning()
      .execute();

    testConversionId = conversion.id;

    // Create test images
    const imageInputs: UploadImageInput[] = [
      {
        conversion_id: testConversionId,
        original_name: 'image1.jpg',
        file_path: '/uploads/image1.jpg',
        file_size: 1024,
        format: 'jpeg',
        order_index: 0
      },
      {
        conversion_id: testConversionId,
        original_name: 'image2.png',
        file_path: '/uploads/image2.png',
        file_size: 2048,
        format: 'png',
        order_index: 1
      },
      {
        conversion_id: testConversionId,
        original_name: 'image3.webp',
        file_path: '/uploads/image3.webp',
        file_size: 1536,
        format: 'webp',
        order_index: 2
      }
    ];

    const insertedImages = await db.insert(imageUploadsTable)
      .values(imageInputs)
      .returning()
      .execute();

    testImages = insertedImages.map(img => img.id);
  };

  it('should reorder images successfully', async () => {
    await createTestConversionWithImages();

    const reorderInput: ReorderImagesInput = {
      conversion_id: testConversionId,
      image_orders: [
        { image_id: testImages[0], order_index: 2 }, // Move first to last
        { image_id: testImages[1], order_index: 0 }, // Move second to first
        { image_id: testImages[2], order_index: 1 }  // Move third to middle
      ]
    };

    const result = await reorderImages(reorderInput);

    // Should return 3 images
    expect(result).toHaveLength(3);

    // Check that images are returned in correct order (sorted by order_index)
    expect(result[0].id).toEqual(testImages[1]); // image2 now at index 0
    expect(result[0].order_index).toEqual(0);
    expect(result[0].original_name).toEqual('image2.png');

    expect(result[1].id).toEqual(testImages[2]); // image3 now at index 1
    expect(result[1].order_index).toEqual(1);
    expect(result[1].original_name).toEqual('image3.webp');

    expect(result[2].id).toEqual(testImages[0]); // image1 now at index 2
    expect(result[2].order_index).toEqual(2);
    expect(result[2].original_name).toEqual('image1.jpg');
  });

  it('should update database with new order indices', async () => {
    await createTestConversionWithImages();

    const reorderInput: ReorderImagesInput = {
      conversion_id: testConversionId,
      image_orders: [
        { image_id: testImages[0], order_index: 1 },
        { image_id: testImages[1], order_index: 2 },
        { image_id: testImages[2], order_index: 0 }
      ]
    };

    await reorderImages(reorderInput);

    // Verify database changes by querying directly
    const updatedImages = await db.select()
      .from(imageUploadsTable)
      .where(eq(imageUploadsTable.conversion_id, testConversionId))
      .orderBy(imageUploadsTable.order_index)
      .execute();

    expect(updatedImages).toHaveLength(3);
    expect(updatedImages[0].id).toEqual(testImages[2]); // image3 at index 0
    expect(updatedImages[0].order_index).toEqual(0);
    expect(updatedImages[1].id).toEqual(testImages[0]); // image1 at index 1
    expect(updatedImages[1].order_index).toEqual(1);
    expect(updatedImages[2].id).toEqual(testImages[1]); // image2 at index 2
    expect(updatedImages[2].order_index).toEqual(2);
  });

  it('should throw error when conversion does not exist', async () => {
    const reorderInput: ReorderImagesInput = {
      conversion_id: 99999, // Non-existent conversion ID
      image_orders: [
        { image_id: 1, order_index: 0 }
      ]
    };

    await expect(reorderImages(reorderInput)).rejects.toThrow(/Conversion with ID 99999 not found/i);
  });

  it('should throw error when conversion is not in pending status', async () => {
    // Create a completed conversion
    const [conversion] = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'a4',
        orientation: 'portrait',
        status: 'completed'
      })
      .returning()
      .execute();

    const reorderInput: ReorderImagesInput = {
      conversion_id: conversion.id,
      image_orders: [
        { image_id: 1, order_index: 0 }
      ]
    };

    await expect(reorderImages(reorderInput)).rejects.toThrow(/Cannot reorder images for conversion in completed status/i);
  });

  it('should throw error when image does not belong to conversion', async () => {
    await createTestConversionWithImages();

    // Create another conversion with an image
    const [otherConversion] = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'a4',
        orientation: 'portrait',
        status: 'pending'
      })
      .returning()
      .execute();

    const [otherImage] = await db.insert(imageUploadsTable)
      .values({
        conversion_id: otherConversion.id,
        original_name: 'other.jpg',
        file_path: '/uploads/other.jpg',
        file_size: 1024,
        format: 'jpeg',
        order_index: 0
      })
      .returning()
      .execute();

    const reorderInput: ReorderImagesInput = {
      conversion_id: testConversionId,
      image_orders: [
        { image_id: otherImage.id, order_index: 0 } // Image from different conversion
      ]
    };

    await expect(reorderImages(reorderInput)).rejects.toThrow(/Image with ID .* not found in conversion/i);
  });

  it('should throw error when duplicate order indices are provided', async () => {
    await createTestConversionWithImages();

    const reorderInput: ReorderImagesInput = {
      conversion_id: testConversionId,
      image_orders: [
        { image_id: testImages[0], order_index: 1 },
        { image_id: testImages[1], order_index: 1 }, // Duplicate order index
        { image_id: testImages[2], order_index: 2 }
      ]
    };

    await expect(reorderImages(reorderInput)).rejects.toThrow(/Duplicate order indices are not allowed/i);
  });

  it('should handle partial reordering correctly', async () => {
    await createTestConversionWithImages();

    // Only reorder two of the three images
    const reorderInput: ReorderImagesInput = {
      conversion_id: testConversionId,
      image_orders: [
        { image_id: testImages[0], order_index: 5 }, // Move to a different position
        { image_id: testImages[2], order_index: 3 }  // Move to another position
      ]
    };

    const result = await reorderImages(reorderInput);

    expect(result).toHaveLength(3);

    // Find updated images by ID
    const image0 = result.find(img => img.id === testImages[0]);
    const image1 = result.find(img => img.id === testImages[1]);
    const image2 = result.find(img => img.id === testImages[2]);

    expect(image0?.order_index).toEqual(5);
    expect(image1?.order_index).toEqual(1); // Unchanged
    expect(image2?.order_index).toEqual(3);

    // Results should be sorted by order_index
    expect(result[0].order_index).toEqual(1); // image1 (unchanged)
    expect(result[1].order_index).toEqual(3); // image2 (updated)
    expect(result[2].order_index).toEqual(5); // image0 (updated)
  });

  it('should handle empty image orders array', async () => {
    await createTestConversionWithImages();

    const reorderInput: ReorderImagesInput = {
      conversion_id: testConversionId,
      image_orders: []
    };

    const result = await reorderImages(reorderInput);

    // Should return all images in original order
    expect(result).toHaveLength(3);
    expect(result[0].order_index).toEqual(0);
    expect(result[1].order_index).toEqual(1);
    expect(result[2].order_index).toEqual(2);
  });
});