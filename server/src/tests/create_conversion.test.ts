import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { pdfConversionsTable } from '../db/schema';
import { type CreateConversionInput } from '../schema';
import { createConversion } from '../handlers/create_conversion';
import { eq } from 'drizzle-orm';

// Test input with A4 portrait settings
const testInput: CreateConversionInput = {
  page_size: 'a4',
  orientation: 'portrait'
};

describe('createConversion', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a PDF conversion with correct settings', async () => {
    const result = await createConversion(testInput);

    // Verify returned conversion data
    expect(result.page_size).toEqual('a4');
    expect(result.orientation).toEqual('portrait');
    expect(result.status).toEqual('pending');
    expect(result.pdf_file_path).toBeNull();
    expect(result.error_message).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.completed_at).toBeNull();
  });

  it('should save conversion to database', async () => {
    const result = await createConversion(testInput);

    // Query the database to verify the record was saved
    const conversions = await db.select()
      .from(pdfConversionsTable)
      .where(eq(pdfConversionsTable.id, result.id))
      .execute();

    expect(conversions).toHaveLength(1);
    const savedConversion = conversions[0];
    
    expect(savedConversion.page_size).toEqual('a4');
    expect(savedConversion.orientation).toEqual('portrait');
    expect(savedConversion.status).toEqual('pending');
    expect(savedConversion.pdf_file_path).toBeNull();
    expect(savedConversion.error_message).toBeNull();
    expect(savedConversion.created_at).toBeInstanceOf(Date);
    expect(savedConversion.completed_at).toBeNull();
  });

  it('should create conversion with letter landscape settings', async () => {
    const letterInput: CreateConversionInput = {
      page_size: 'letter',
      orientation: 'landscape'
    };

    const result = await createConversion(letterInput);

    expect(result.page_size).toEqual('letter');
    expect(result.orientation).toEqual('landscape');
    expect(result.status).toEqual('pending');
    expect(result.id).toBeDefined();
  });

  it('should create conversion with legal portrait settings', async () => {
    const legalInput: CreateConversionInput = {
      page_size: 'legal',
      orientation: 'portrait'
    };

    const result = await createConversion(legalInput);

    expect(result.page_size).toEqual('legal');
    expect(result.orientation).toEqual('portrait');
    expect(result.status).toEqual('pending');
    expect(result.id).toBeDefined();
  });

  it('should create multiple conversions with unique IDs', async () => {
    const conversion1 = await createConversion({
      page_size: 'a4',
      orientation: 'portrait'
    });

    const conversion2 = await createConversion({
      page_size: 'a3',
      orientation: 'landscape'
    });

    const conversion3 = await createConversion({
      page_size: 'a5',
      orientation: 'portrait'
    });

    // Verify all have unique IDs
    expect(conversion1.id).not.toEqual(conversion2.id);
    expect(conversion2.id).not.toEqual(conversion3.id);
    expect(conversion1.id).not.toEqual(conversion3.id);

    // Verify all are saved in database
    const allConversions = await db.select()
      .from(pdfConversionsTable)
      .execute();

    expect(allConversions).toHaveLength(3);
  });

  it('should set created_at timestamp automatically', async () => {
    const beforeCreation = new Date();
    const result = await createConversion(testInput);
    const afterCreation = new Date();

    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
  });
});