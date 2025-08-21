import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { pdfConversionsTable } from '../db/schema';
import { type UpdateConversionInput } from '../schema';
import { updateConversion } from '../handlers/update_conversion';
import { eq } from 'drizzle-orm';

describe('updateConversion', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test conversion
  const createTestConversion = async (status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending') => {
    const result = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'a4',
        orientation: 'portrait',
        status: status
      })
      .returning()
      .execute();
    
    return result[0];
  };

  it('should update page_size only', async () => {
    const testConversion = await createTestConversion();
    
    const input: UpdateConversionInput = {
      id: testConversion.id,
      page_size: 'letter'
    };

    const result = await updateConversion(input);

    expect(result.id).toEqual(testConversion.id);
    expect(result.page_size).toEqual('letter');
    expect(result.orientation).toEqual('portrait'); // Should remain unchanged
    expect(result.status).toEqual('pending');
    expect(result.pdf_file_path).toBeNull();
    expect(result.error_message).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.completed_at).toBeNull();
  });

  it('should update orientation only', async () => {
    const testConversion = await createTestConversion();
    
    const input: UpdateConversionInput = {
      id: testConversion.id,
      orientation: 'landscape'
    };

    const result = await updateConversion(input);

    expect(result.id).toEqual(testConversion.id);
    expect(result.page_size).toEqual('a4'); // Should remain unchanged
    expect(result.orientation).toEqual('landscape');
    expect(result.status).toEqual('pending');
  });

  it('should update both page_size and orientation', async () => {
    const testConversion = await createTestConversion();
    
    const input: UpdateConversionInput = {
      id: testConversion.id,
      page_size: 'a3',
      orientation: 'landscape'
    };

    const result = await updateConversion(input);

    expect(result.id).toEqual(testConversion.id);
    expect(result.page_size).toEqual('a3');
    expect(result.orientation).toEqual('landscape');
    expect(result.status).toEqual('pending');
  });

  it('should save changes to database', async () => {
    const testConversion = await createTestConversion();
    
    const input: UpdateConversionInput = {
      id: testConversion.id,
      page_size: 'legal',
      orientation: 'landscape'
    };

    await updateConversion(input);

    // Verify changes were persisted
    const updatedConversion = await db.select()
      .from(pdfConversionsTable)
      .where(eq(pdfConversionsTable.id, testConversion.id))
      .execute();

    expect(updatedConversion).toHaveLength(1);
    expect(updatedConversion[0].page_size).toEqual('legal');
    expect(updatedConversion[0].orientation).toEqual('landscape');
    expect(updatedConversion[0].status).toEqual('pending');
  });

  it('should return unchanged conversion when no fields provided', async () => {
    const testConversion = await createTestConversion();
    
    const input: UpdateConversionInput = {
      id: testConversion.id
    };

    const result = await updateConversion(input);

    expect(result.id).toEqual(testConversion.id);
    expect(result.page_size).toEqual('a4');
    expect(result.orientation).toEqual('portrait');
    expect(result.status).toEqual('pending');
  });

  it('should throw error when conversion does not exist', async () => {
    const input: UpdateConversionInput = {
      id: 99999, // Non-existent ID
      page_size: 'letter'
    };

    await expect(updateConversion(input)).rejects.toThrow(/conversion with id 99999 not found/i);
  });

  it('should throw error when trying to update processing conversion', async () => {
    const testConversion = await createTestConversion('processing');
    
    const input: UpdateConversionInput = {
      id: testConversion.id,
      page_size: 'letter'
    };

    await expect(updateConversion(input)).rejects.toThrow(/cannot update conversion with status: processing/i);
  });

  it('should throw error when trying to update completed conversion', async () => {
    const testConversion = await createTestConversion('completed');
    
    const input: UpdateConversionInput = {
      id: testConversion.id,
      page_size: 'letter'
    };

    await expect(updateConversion(input)).rejects.toThrow(/cannot update conversion with status: completed/i);
  });

  it('should throw error when trying to update failed conversion', async () => {
    const testConversion = await createTestConversion('failed');
    
    const input: UpdateConversionInput = {
      id: testConversion.id,
      page_size: 'letter'
    };

    await expect(updateConversion(input)).rejects.toThrow(/cannot update conversion with status: failed/i);
  });

  it('should handle all valid page sizes', async () => {
    const testConversion = await createTestConversion();
    
    const pageSizes = ['a4', 'letter', 'legal', 'a3', 'a5'] as const;
    
    for (const pageSize of pageSizes) {
      const input: UpdateConversionInput = {
        id: testConversion.id,
        page_size: pageSize
      };

      const result = await updateConversion(input);
      expect(result.page_size).toEqual(pageSize);
    }
  });

  it('should handle all valid orientations', async () => {
    const testConversion = await createTestConversion();
    
    const orientations = ['portrait', 'landscape'] as const;
    
    for (const orientation of orientations) {
      const input: UpdateConversionInput = {
        id: testConversion.id,
        orientation: orientation
      };

      const result = await updateConversion(input);
      expect(result.orientation).toEqual(orientation);
    }
  });
});