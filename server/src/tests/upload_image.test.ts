import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { imageUploadsTable, pdfConversionsTable } from '../db/schema';
import { type UploadImageInput, type CreateConversionInput } from '../schema';
import { uploadImage } from '../handlers/upload_image';
import { eq } from 'drizzle-orm';

// Test data for creating a conversion
const testConversionInput: CreateConversionInput = {
  page_size: 'a4',
  orientation: 'portrait'
};

// Test data for uploading an image
const testUploadInput: UploadImageInput = {
  conversion_id: 1, // Will be set dynamically
  original_name: 'test-image.jpg',
  file_path: '/uploads/test-image.jpg',
  file_size: 1024000,
  format: 'jpeg',
  order_index: 0
};

describe('uploadImage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let conversionId: number;

  beforeEach(async () => {
    // Create a test conversion before each test
    const result = await db.insert(pdfConversionsTable)
      .values({
        page_size: testConversionInput.page_size,
        orientation: testConversionInput.orientation,
        status: 'pending'
      })
      .returning()
      .execute();
    
    conversionId = result[0].id;
  });

  it('should upload an image successfully', async () => {
    const input = { ...testUploadInput, conversion_id: conversionId };
    const result = await uploadImage(input);

    // Basic field validation
    expect(result.original_name).toEqual('test-image.jpg');
    expect(result.file_path).toEqual('/uploads/test-image.jpg');
    expect(result.file_size).toEqual(1024000);
    expect(result.format).toEqual('jpeg');
    expect(result.order_index).toEqual(0);
    expect(result.conversion_id).toEqual(conversionId);
    expect(result.id).toBeDefined();
    expect(result.uploaded_at).toBeInstanceOf(Date);
  });

  it('should save image to database', async () => {
    const input = { ...testUploadInput, conversion_id: conversionId };
    const result = await uploadImage(input);

    // Query using proper drizzle syntax
    const images = await db.select()
      .from(imageUploadsTable)
      .where(eq(imageUploadsTable.id, result.id))
      .execute();

    expect(images).toHaveLength(1);
    expect(images[0].original_name).toEqual('test-image.jpg');
    expect(images[0].file_path).toEqual('/uploads/test-image.jpg');
    expect(images[0].file_size).toEqual(1024000);
    expect(images[0].format).toEqual('jpeg');
    expect(images[0].order_index).toEqual(0);
    expect(images[0].conversion_id).toEqual(conversionId);
    expect(images[0].uploaded_at).toBeInstanceOf(Date);
  });

  it('should handle multiple image uploads with different order indices', async () => {
    const input1 = { ...testUploadInput, conversion_id: conversionId, order_index: 0, original_name: 'image1.png', format: 'png' as const };
    const input2 = { ...testUploadInput, conversion_id: conversionId, order_index: 1, original_name: 'image2.webp', format: 'webp' as const };

    const result1 = await uploadImage(input1);
    const result2 = await uploadImage(input2);

    expect(result1.order_index).toEqual(0);
    expect(result1.original_name).toEqual('image1.png');
    expect(result1.format).toEqual('png');

    expect(result2.order_index).toEqual(1);
    expect(result2.original_name).toEqual('image2.webp');
    expect(result2.format).toEqual('webp');

    // Verify both images are in database
    const images = await db.select()
      .from(imageUploadsTable)
      .where(eq(imageUploadsTable.conversion_id, conversionId))
      .execute();

    expect(images).toHaveLength(2);
  });

  it('should handle different image formats', async () => {
    const formats = ['jpeg', 'png', 'webp', 'gif'] as const;
    
    for (let i = 0; i < formats.length; i++) {
      const input = { 
        ...testUploadInput, 
        conversion_id: conversionId, 
        format: formats[i],
        order_index: i,
        original_name: `test.${formats[i]}`
      };
      
      const result = await uploadImage(input);
      expect(result.format).toEqual(formats[i]);
      expect(result.order_index).toEqual(i);
    }
  });

  it('should throw error when conversion does not exist', async () => {
    const input = { ...testUploadInput, conversion_id: 99999 };
    
    await expect(uploadImage(input)).rejects.toThrow(/Conversion with ID 99999 not found/i);
  });

  it('should throw error when conversion is not in pending status', async () => {
    // Update conversion to completed status
    await db.update(pdfConversionsTable)
      .set({ status: 'completed' })
      .where(eq(pdfConversionsTable.id, conversionId))
      .execute();

    const input = { ...testUploadInput, conversion_id: conversionId };
    
    await expect(uploadImage(input)).rejects.toThrow(/Cannot upload images to conversion with status: completed/i);
  });

  it('should throw error when conversion is in processing status', async () => {
    // Update conversion to processing status
    await db.update(pdfConversionsTable)
      .set({ status: 'processing' })
      .where(eq(pdfConversionsTable.id, conversionId))
      .execute();

    const input = { ...testUploadInput, conversion_id: conversionId };
    
    await expect(uploadImage(input)).rejects.toThrow(/Cannot upload images to conversion with status: processing/i);
  });

  it('should throw error when conversion is in failed status', async () => {
    // Update conversion to failed status
    await db.update(pdfConversionsTable)
      .set({ status: 'failed' })
      .where(eq(pdfConversionsTable.id, conversionId))
      .execute();

    const input = { ...testUploadInput, conversion_id: conversionId };
    
    await expect(uploadImage(input)).rejects.toThrow(/Cannot upload images to conversion with status: failed/i);
  });

  it('should handle large file sizes', async () => {
    const input = { 
      ...testUploadInput, 
      conversion_id: conversionId, 
      file_size: 10485760, // 10MB
      original_name: 'large-image.png',
      format: 'png' as const
    };
    
    const result = await uploadImage(input);
    expect(result.file_size).toEqual(10485760);
    expect(result.original_name).toEqual('large-image.png');
    expect(result.format).toEqual('png');
  });
});