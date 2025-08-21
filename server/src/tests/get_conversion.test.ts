import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { pdfConversionsTable, imageUploadsTable } from '../db/schema';
import { type CreateConversionInput, type UploadImageInput } from '../schema';
import { getConversion } from '../handlers/get_conversion';

// Test data
const testConversionInput: CreateConversionInput = {
  page_size: 'a4',
  orientation: 'portrait'
};

const testImageInput1: Omit<UploadImageInput, 'conversion_id'> = {
  original_name: 'image1.jpg',
  file_path: '/uploads/image1.jpg',
  file_size: 1024,
  format: 'jpeg',
  order_index: 0
};

const testImageInput2: Omit<UploadImageInput, 'conversion_id'> = {
  original_name: 'image2.png',
  file_path: '/uploads/image2.png',
  file_size: 2048,
  format: 'png',
  order_index: 1
};

const testImageInput3: Omit<UploadImageInput, 'conversion_id'> = {
  original_name: 'image3.webp',
  file_path: '/uploads/image3.webp',
  file_size: 1536,
  format: 'webp',
  order_index: 2
};

describe('getConversion', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null for non-existent conversion', async () => {
    const result = await getConversion(999);
    expect(result).toBeNull();
  });

  it('should retrieve conversion without images', async () => {
    // Create conversion
    const conversionResult = await db.insert(pdfConversionsTable)
      .values(testConversionInput)
      .returning()
      .execute();

    const conversionId = conversionResult[0].id;

    const result = await getConversion(conversionId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(conversionId);
    expect(result!.page_size).toEqual('a4');
    expect(result!.orientation).toEqual('portrait');
    expect(result!.status).toEqual('pending');
    expect(result!.pdf_file_path).toBeNull();
    expect(result!.error_message).toBeNull();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.completed_at).toBeNull();
    expect(result!.images).toEqual([]);
  });

  it('should retrieve conversion with single image', async () => {
    // Create conversion
    const conversionResult = await db.insert(pdfConversionsTable)
      .values(testConversionInput)
      .returning()
      .execute();

    const conversionId = conversionResult[0].id;

    // Add image
    await db.insert(imageUploadsTable)
      .values({
        ...testImageInput1,
        conversion_id: conversionId
      })
      .execute();

    const result = await getConversion(conversionId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(conversionId);
    expect(result!.images).toHaveLength(1);
    expect(result!.images[0].original_name).toEqual('image1.jpg');
    expect(result!.images[0].file_path).toEqual('/uploads/image1.jpg');
    expect(result!.images[0].file_size).toEqual(1024);
    expect(result!.images[0].format).toEqual('jpeg');
    expect(result!.images[0].order_index).toEqual(0);
    expect(result!.images[0].conversion_id).toEqual(conversionId);
    expect(result!.images[0].uploaded_at).toBeInstanceOf(Date);
  });

  it('should retrieve conversion with multiple images in correct order', async () => {
    // Create conversion
    const conversionResult = await db.insert(pdfConversionsTable)
      .values(testConversionInput)
      .returning()
      .execute();

    const conversionId = conversionResult[0].id;

    // Add images in mixed order (insert order ≠ display order)
    await db.insert(imageUploadsTable)
      .values([
        {
          ...testImageInput3, // order_index: 2
          conversion_id: conversionId
        },
        {
          ...testImageInput1, // order_index: 0
          conversion_id: conversionId
        },
        {
          ...testImageInput2, // order_index: 1
          conversion_id: conversionId
        }
      ])
      .execute();

    const result = await getConversion(conversionId);

    expect(result).not.toBeNull();
    expect(result!.images).toHaveLength(3);
    
    // Verify images are ordered by order_index
    expect(result!.images[0].original_name).toEqual('image1.jpg');
    expect(result!.images[0].order_index).toEqual(0);
    expect(result!.images[1].original_name).toEqual('image2.png');
    expect(result!.images[1].order_index).toEqual(1);
    expect(result!.images[2].original_name).toEqual('image3.webp');
    expect(result!.images[2].order_index).toEqual(2);

    // Verify all images have correct conversion_id
    result!.images.forEach(image => {
      expect(image.conversion_id).toEqual(conversionId);
    });
  });

  it('should retrieve completed conversion with pdf file path', async () => {
    // Create completed conversion
    const completedAt = new Date();
    const conversionResult = await db.insert(pdfConversionsTable)
      .values({
        ...testConversionInput,
        status: 'completed',
        pdf_file_path: '/outputs/conversion.pdf',
        completed_at: completedAt
      })
      .returning()
      .execute();

    const conversionId = conversionResult[0].id;

    const result = await getConversion(conversionId);

    expect(result).not.toBeNull();
    expect(result!.status).toEqual('completed');
    expect(result!.pdf_file_path).toEqual('/outputs/conversion.pdf');
    expect(result!.completed_at).toBeInstanceOf(Date);
    expect(result!.error_message).toBeNull();
  });

  it('should retrieve failed conversion with error message', async () => {
    // Create failed conversion
    const conversionResult = await db.insert(pdfConversionsTable)
      .values({
        ...testConversionInput,
        status: 'failed',
        error_message: 'Image processing failed'
      })
      .returning()
      .execute();

    const conversionId = conversionResult[0].id;

    const result = await getConversion(conversionId);

    expect(result).not.toBeNull();
    expect(result!.status).toEqual('failed');
    expect(result!.error_message).toEqual('Image processing failed');
    expect(result!.pdf_file_path).toBeNull();
    expect(result!.completed_at).toBeNull();
  });

  it('should handle different page sizes and orientations', async () => {
    // Test with different settings
    const legalLandscapeConversion = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'legal',
        orientation: 'landscape'
      })
      .returning()
      .execute();

    const conversionId = legalLandscapeConversion[0].id;

    const result = await getConversion(conversionId);

    expect(result).not.toBeNull();
    expect(result!.page_size).toEqual('legal');
    expect(result!.orientation).toEqual('landscape');
  });

  it('should handle processing status conversion', async () => {
    // Create processing conversion
    const conversionResult = await db.insert(pdfConversionsTable)
      .values({
        ...testConversionInput,
        status: 'processing'
      })
      .returning()
      .execute();

    const conversionId = conversionResult[0].id;

    const result = await getConversion(conversionId);

    expect(result).not.toBeNull();
    expect(result!.status).toEqual('processing');
    expect(result!.pdf_file_path).toBeNull();
    expect(result!.completed_at).toBeNull();
    expect(result!.error_message).toBeNull();
  });
});