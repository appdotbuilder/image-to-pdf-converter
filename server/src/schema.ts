import { z } from 'zod';

// Supported image formats enum
export const imageFormatSchema = z.enum(['jpeg', 'png', 'webp', 'gif']);
export type ImageFormat = z.infer<typeof imageFormatSchema>;

// Page size options enum
export const pageSizeSchema = z.enum(['a4', 'letter', 'legal', 'a3', 'a5']);
export type PageSize = z.infer<typeof pageSizeSchema>;

// Page orientation enum
export const orientationSchema = z.enum(['portrait', 'landscape']);
export type Orientation = z.infer<typeof orientationSchema>;

// Conversion status enum
export const conversionStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export type ConversionStatus = z.infer<typeof conversionStatusSchema>;

// Image upload schema
export const imageUploadSchema = z.object({
  id: z.number(),
  original_name: z.string(),
  file_path: z.string(),
  file_size: z.number().int(),
  format: imageFormatSchema,
  order_index: z.number().int(),
  conversion_id: z.number(),
  uploaded_at: z.coerce.date()
});

export type ImageUpload = z.infer<typeof imageUploadSchema>;

// PDF conversion schema
export const pdfConversionSchema = z.object({
  id: z.number(),
  page_size: pageSizeSchema,
  orientation: orientationSchema,
  status: conversionStatusSchema,
  pdf_file_path: z.string().nullable(),
  error_message: z.string().nullable(),
  created_at: z.coerce.date(),
  completed_at: z.coerce.date().nullable()
});

export type PdfConversion = z.infer<typeof pdfConversionSchema>;

// Input schema for creating a new conversion
export const createConversionInputSchema = z.object({
  page_size: pageSizeSchema,
  orientation: orientationSchema
});

export type CreateConversionInput = z.infer<typeof createConversionInputSchema>;

// Input schema for uploading images
export const uploadImageInputSchema = z.object({
  conversion_id: z.number(),
  original_name: z.string(),
  file_path: z.string(),
  file_size: z.number().int().positive(),
  format: imageFormatSchema,
  order_index: z.number().int().nonnegative()
});

export type UploadImageInput = z.infer<typeof uploadImageInputSchema>;

// Input schema for reordering images
export const reorderImagesInputSchema = z.object({
  conversion_id: z.number(),
  image_orders: z.array(z.object({
    image_id: z.number(),
    order_index: z.number().int().nonnegative()
  }))
});

export type ReorderImagesInput = z.infer<typeof reorderImagesInputSchema>;

// Input schema for updating conversion settings
export const updateConversionInputSchema = z.object({
  id: z.number(),
  page_size: pageSizeSchema.optional(),
  orientation: orientationSchema.optional()
});

export type UpdateConversionInput = z.infer<typeof updateConversionInputSchema>;

// Input schema for processing PDF conversion
export const processConversionInputSchema = z.object({
  conversion_id: z.number()
});

export type ProcessConversionInput = z.infer<typeof processConversionInputSchema>;

// Response schema for conversion with images
export const conversionWithImagesSchema = z.object({
  id: z.number(),
  page_size: pageSizeSchema,
  orientation: orientationSchema,
  status: conversionStatusSchema,
  pdf_file_path: z.string().nullable(),
  error_message: z.string().nullable(),
  created_at: z.coerce.date(),
  completed_at: z.coerce.date().nullable(),
  images: z.array(imageUploadSchema)
});

export type ConversionWithImages = z.infer<typeof conversionWithImagesSchema>;