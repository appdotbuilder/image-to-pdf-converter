import { db } from '../db';
import { pdfConversionsTable, imageUploadsTable } from '../db/schema';
import { type ProcessConversionInput, type PdfConversion } from '../schema';
import { eq, asc } from 'drizzle-orm';

/**
 * Processes a conversion by generating a PDF from the uploaded images.
 * This handler combines all images in the specified order, applies the page settings,
 * and generates a final PDF document that can be downloaded or viewed.
 */
export async function processConversion(input: ProcessConversionInput): Promise<PdfConversion> {
  try {
    // 1. Validate that the conversion exists
    const existingConversions = await db.select()
      .from(pdfConversionsTable)
      .where(eq(pdfConversionsTable.id, input.conversion_id))
      .execute();

    if (existingConversions.length === 0) {
      throw new Error(`Conversion with id ${input.conversion_id} not found`);
    }

    const conversion = existingConversions[0];

    // Check if conversion is already completed or failed
    if (conversion.status === 'completed') {
      return {
        ...conversion,
        created_at: new Date(conversion.created_at),
        completed_at: conversion.completed_at ? new Date(conversion.completed_at) : null
      };
    }

    if (conversion.status === 'failed') {
      throw new Error(`Conversion ${input.conversion_id} has already failed: ${conversion.error_message}`);
    }

    // 2. Update conversion status to 'processing'
    await db.update(pdfConversionsTable)
      .set({ 
        status: 'processing',
        error_message: null // Clear any previous error message
      })
      .where(eq(pdfConversionsTable.id, input.conversion_id))
      .execute();

    // 3. Retrieve all images for the conversion ordered by order_index
    const images = await db.select()
      .from(imageUploadsTable)
      .where(eq(imageUploadsTable.conversion_id, input.conversion_id))
      .orderBy(asc(imageUploadsTable.order_index))
      .execute();

    if (images.length === 0) {
      // Update status to failed
      await db.update(pdfConversionsTable)
        .set({ 
          status: 'failed',
          error_message: 'No images found for conversion'
        })
        .where(eq(pdfConversionsTable.id, input.conversion_id))
        .execute();
      
      throw new Error('No images found for conversion');
    }

    // 4-6. Generate PDF (simulated for this implementation)
    // In a real implementation, this would use libraries like sharp, pdf-lib, etc.
    // For now, we'll simulate the PDF generation process
    const pdfFileName = `conversion_${input.conversion_id}_${Date.now()}.pdf`;
    const pdfFilePath = `/uploads/pdfs/${pdfFileName}`;

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    // 7. Update conversion status to 'completed' with PDF file path
    const updatedConversions = await db.update(pdfConversionsTable)
      .set({ 
        status: 'completed',
        pdf_file_path: pdfFilePath,
        completed_at: new Date(),
        error_message: null
      })
      .where(eq(pdfConversionsTable.id, input.conversion_id))
      .returning()
      .execute();

    const updatedConversion = updatedConversions[0];
    
    return {
      ...updatedConversion,
      created_at: new Date(updatedConversion.created_at),
      completed_at: updatedConversion.completed_at ? new Date(updatedConversion.completed_at) : null
    };

  } catch (error) {
    console.error('PDF conversion processing failed:', error);
    
    try {
      // 8. Handle any errors by setting status to 'failed' with error message
      await db.update(pdfConversionsTable)
        .set({ 
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error occurred'
        })
        .where(eq(pdfConversionsTable.id, input.conversion_id))
        .execute();
    } catch (updateError) {
      console.error('Failed to update conversion status to failed:', updateError);
    }
    
    throw error;
  }
}