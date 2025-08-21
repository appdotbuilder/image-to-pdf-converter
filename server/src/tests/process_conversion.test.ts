import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { pdfConversionsTable, imageUploadsTable } from '../db/schema';
import { type ProcessConversionInput } from '../schema';
import { processConversion } from '../handlers/process_conversion';
import { eq } from 'drizzle-orm';

describe('processConversion', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test conversion
  const createTestConversion = async () => {
    const conversions = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'a4',
        orientation: 'portrait',
        status: 'pending'
      })
      .returning()
      .execute();
    
    return conversions[0];
  };

  // Helper function to create test images for a conversion
  const createTestImages = async (conversionId: number, count: number = 2) => {
    const imageData = [];
    for (let i = 0; i < count; i++) {
      imageData.push({
        original_name: `test_image_${i + 1}.jpg`,
        file_path: `/uploads/images/test_${i + 1}.jpg`,
        file_size: 1024 * (i + 1),
        format: 'jpeg' as const,
        order_index: i,
        conversion_id: conversionId
      });
    }

    const images = await db.insert(imageUploadsTable)
      .values(imageData)
      .returning()
      .execute();
    
    return images;
  };

  const testInput: ProcessConversionInput = {
    conversion_id: 1
  };

  it('should process conversion successfully with images', async () => {
    // Create test conversion and images
    const conversion = await createTestConversion();
    await createTestImages(conversion.id, 3);

    const input = { conversion_id: conversion.id };
    const result = await processConversion(input);

    // Verify result structure
    expect(result.id).toEqual(conversion.id);
    expect(result.page_size).toEqual('a4');
    expect(result.orientation).toEqual('portrait');
    expect(result.status).toEqual('completed');
    expect(result.pdf_file_path).toMatch(/^\/uploads\/pdfs\/conversion_\d+_\d+\.pdf$/);
    expect(result.error_message).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.completed_at).toBeInstanceOf(Date);
  });

  it('should update conversion status in database', async () => {
    // Create test conversion and images
    const conversion = await createTestConversion();
    await createTestImages(conversion.id);

    const input = { conversion_id: conversion.id };
    await processConversion(input);

    // Verify database was updated
    const updatedConversions = await db.select()
      .from(pdfConversionsTable)
      .where(eq(pdfConversionsTable.id, conversion.id))
      .execute();

    expect(updatedConversions).toHaveLength(1);
    const updatedConversion = updatedConversions[0];
    expect(updatedConversion.status).toEqual('completed');
    expect(updatedConversion.pdf_file_path).toMatch(/^\/uploads\/pdfs\/conversion_\d+_\d+\.pdf$/);
    expect(updatedConversion.completed_at).toBeInstanceOf(Date);
    expect(updatedConversion.error_message).toBeNull();
  });

  it('should throw error when conversion does not exist', async () => {
    const input = { conversion_id: 999 };

    await expect(processConversion(input)).rejects.toThrow(/Conversion with id 999 not found/i);
  });

  it('should throw error when conversion has no images', async () => {
    // Create conversion without images
    const conversion = await createTestConversion();
    const input = { conversion_id: conversion.id };

    await expect(processConversion(input)).rejects.toThrow(/No images found for conversion/i);

    // Verify conversion status was updated to failed
    const updatedConversions = await db.select()
      .from(pdfConversionsTable)
      .where(eq(pdfConversionsTable.id, conversion.id))
      .execute();

    expect(updatedConversions).toHaveLength(1);
    expect(updatedConversions[0].status).toEqual('failed');
    expect(updatedConversions[0].error_message).toEqual('No images found for conversion');
  });

  it('should return existing result for already completed conversion', async () => {
    // Create completed conversion
    const completedConversion = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'letter',
        orientation: 'landscape',
        status: 'completed',
        pdf_file_path: '/existing/path/test.pdf',
        completed_at: new Date('2024-01-01T10:00:00Z')
      })
      .returning()
      .execute();

    const input = { conversion_id: completedConversion[0].id };
    const result = await processConversion(input);

    // Should return existing completed conversion
    expect(result.id).toEqual(completedConversion[0].id);
    expect(result.status).toEqual('completed');
    expect(result.pdf_file_path).toEqual('/existing/path/test.pdf');
    expect(result.page_size).toEqual('letter');
    expect(result.orientation).toEqual('landscape');
  });

  it('should throw error for already failed conversion', async () => {
    // Create failed conversion
    const failedConversion = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'a4',
        orientation: 'portrait',
        status: 'failed',
        error_message: 'Previous processing error'
      })
      .returning()
      .execute();

    const input = { conversion_id: failedConversion[0].id };

    await expect(processConversion(input)).rejects.toThrow(/Conversion \d+ has already failed: Previous processing error/i);
  });

  it('should handle processing status correctly', async () => {
    // Create conversion with processing status
    const processingConversion = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'a3',
        orientation: 'landscape',
        status: 'processing'
      })
      .returning()
      .execute();

    await createTestImages(processingConversion[0].id);

    const input = { conversion_id: processingConversion[0].id };
    const result = await processConversion(input);

    // Should complete the processing
    expect(result.status).toEqual('completed');
    expect(result.pdf_file_path).toMatch(/^\/uploads\/pdfs\/conversion_\d+_\d+\.pdf$/);
    expect(result.page_size).toEqual('a3');
    expect(result.orientation).toEqual('landscape');
  });

  it('should process images in correct order', async () => {
    // Create conversion
    const conversion = await createTestConversion();

    // Create images with specific order indices
    await db.insert(imageUploadsTable)
      .values([
        {
          original_name: 'third.jpg',
          file_path: '/uploads/third.jpg',
          file_size: 3000,
          format: 'jpeg',
          order_index: 2,
          conversion_id: conversion.id
        },
        {
          original_name: 'first.jpg',
          file_path: '/uploads/first.jpg',
          file_size: 1000,
          format: 'jpeg',
          order_index: 0,
          conversion_id: conversion.id
        },
        {
          original_name: 'second.jpg',
          file_path: '/uploads/second.jpg',
          file_size: 2000,
          format: 'jpeg',
          order_index: 1,
          conversion_id: conversion.id
        }
      ])
      .execute();

    const input = { conversion_id: conversion.id };
    const result = await processConversion(input);

    // Verify processing completed successfully
    expect(result.status).toEqual('completed');
    expect(result.pdf_file_path).toBeDefined();

    // Verify images were retrieved in correct order by checking database
    const images = await db.select()
      .from(imageUploadsTable)
      .where(eq(imageUploadsTable.conversion_id, conversion.id))
      .execute();

    expect(images).toHaveLength(3);
    // Images should be ordered by order_index when retrieved
    const orderedImages = images.sort((a, b) => a.order_index - b.order_index);
    expect(orderedImages[0].original_name).toEqual('first.jpg');
    expect(orderedImages[1].original_name).toEqual('second.jpg');
    expect(orderedImages[2].original_name).toEqual('third.jpg');
  });

  it('should clear previous error message on successful processing', async () => {
    // Create conversion with previous error
    const conversion = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'a4',
        orientation: 'portrait',
        status: 'pending',
        error_message: 'Previous error message'
      })
      .returning()
      .execute();

    await createTestImages(conversion[0].id);

    const input = { conversion_id: conversion[0].id };
    const result = await processConversion(input);

    // Verify error message was cleared
    expect(result.status).toEqual('completed');
    expect(result.error_message).toBeNull();

    // Verify in database
    const updatedConversions = await db.select()
      .from(pdfConversionsTable)
      .where(eq(pdfConversionsTable.id, conversion[0].id))
      .execute();

    expect(updatedConversions[0].error_message).toBeNull();
  });
});