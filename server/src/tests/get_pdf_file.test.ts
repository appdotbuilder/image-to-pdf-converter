import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { pdfConversionsTable } from '../db/schema';
import { getPdfFile } from '../handlers/get_pdf_file';
import { writeFile, mkdir, unlink, rmdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('getPdfFile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testTempDir = join(tmpdir(), 'pdf-test');
  
  beforeEach(async () => {
    // Create temp directory for test files
    try {
      await mkdir(testTempDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore
    }
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rmdir(testTempDir, { recursive: true });
    } catch (error) {
      // Directory might not exist or be in use, ignore
    }
  });

  it('should return PDF buffer for completed conversion', async () => {
    // Create a test PDF file
    const testPdfPath = join(testTempDir, 'test.pdf');
    const testPdfContent = Buffer.from('%PDF-1.4\ntest pdf content');
    await writeFile(testPdfPath, testPdfContent);

    // Create a completed conversion
    const conversions = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'a4',
        orientation: 'portrait',
        status: 'completed',
        pdf_file_path: testPdfPath,
        completed_at: new Date()
      })
      .returning()
      .execute();

    const conversion = conversions[0];
    const result = await getPdfFile(conversion.id);

    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Buffer);
    expect(result?.equals(testPdfContent)).toBe(true);

    // Clean up
    await unlink(testPdfPath);
  });

  it('should return null for non-existent conversion', async () => {
    const result = await getPdfFile(99999);
    expect(result).toBeNull();
  });

  it('should return null for pending conversion', async () => {
    // Create a pending conversion
    const conversions = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'a4',
        orientation: 'portrait',
        status: 'pending',
        pdf_file_path: null
      })
      .returning()
      .execute();

    const conversion = conversions[0];
    const result = await getPdfFile(conversion.id);

    expect(result).toBeNull();
  });

  it('should return null for processing conversion', async () => {
    // Create a processing conversion
    const conversions = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'a4',
        orientation: 'portrait',
        status: 'processing',
        pdf_file_path: null
      })
      .returning()
      .execute();

    const conversion = conversions[0];
    const result = await getPdfFile(conversion.id);

    expect(result).toBeNull();
  });

  it('should return null for failed conversion', async () => {
    // Create a failed conversion
    const conversions = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'a4',
        orientation: 'portrait',
        status: 'failed',
        pdf_file_path: null,
        error_message: 'Conversion failed'
      })
      .returning()
      .execute();

    const conversion = conversions[0];
    const result = await getPdfFile(conversion.id);

    expect(result).toBeNull();
  });

  it('should return null for completed conversion without pdf_file_path', async () => {
    // Create a completed conversion but without PDF file path
    const conversions = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'a4',
        orientation: 'portrait',
        status: 'completed',
        pdf_file_path: null,
        completed_at: new Date()
      })
      .returning()
      .execute();

    const conversion = conversions[0];
    const result = await getPdfFile(conversion.id);

    expect(result).toBeNull();
  });

  it('should return null when PDF file does not exist on filesystem', async () => {
    // Create a completed conversion with non-existent file path
    const nonExistentPath = join(testTempDir, 'non-existent.pdf');
    
    const conversions = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'a4',
        orientation: 'portrait',
        status: 'completed',
        pdf_file_path: nonExistentPath,
        completed_at: new Date()
      })
      .returning()
      .execute();

    const conversion = conversions[0];
    const result = await getPdfFile(conversion.id);

    expect(result).toBeNull();
  });

  it('should handle different PDF content correctly', async () => {
    // Test with different PDF content
    const testPdfPath = join(testTempDir, 'complex.pdf');
    const complexPdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    await writeFile(testPdfPath, complexPdfContent);

    const conversions = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'letter',
        orientation: 'landscape',
        status: 'completed',
        pdf_file_path: testPdfPath,
        completed_at: new Date()
      })
      .returning()
      .execute();

    const conversion = conversions[0];
    const result = await getPdfFile(conversion.id);

    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Buffer);
    expect(result?.equals(complexPdfContent)).toBe(true);
    expect(result?.length).toBe(complexPdfContent.length);

    // Clean up
    await unlink(testPdfPath);
  });

  it('should handle empty PDF file', async () => {
    // Test with empty PDF file
    const testPdfPath = join(testTempDir, 'empty.pdf');
    const emptyContent = Buffer.from('');
    await writeFile(testPdfPath, emptyContent);

    const conversions = await db.insert(pdfConversionsTable)
      .values({
        page_size: 'a3',
        orientation: 'portrait',
        status: 'completed',
        pdf_file_path: testPdfPath,
        completed_at: new Date()
      })
      .returning()
      .execute();

    const conversion = conversions[0];
    const result = await getPdfFile(conversion.id);

    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Buffer);
    expect(result?.length).toBe(0);

    // Clean up
    await unlink(testPdfPath);
  });
});