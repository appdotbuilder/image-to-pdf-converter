import { serial, text, pgTable, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums for the database
export const imageFormatEnum = pgEnum('image_format', ['jpeg', 'png', 'webp', 'gif']);
export const pageSizeEnum = pgEnum('page_size', ['a4', 'letter', 'legal', 'a3', 'a5']);
export const orientationEnum = pgEnum('orientation', ['portrait', 'landscape']);
export const conversionStatusEnum = pgEnum('conversion_status', ['pending', 'processing', 'completed', 'failed']);

// PDF conversions table
export const pdfConversionsTable = pgTable('pdf_conversions', {
  id: serial('id').primaryKey(),
  page_size: pageSizeEnum('page_size').notNull(),
  orientation: orientationEnum('orientation').notNull(),
  status: conversionStatusEnum('status').notNull().default('pending'),
  pdf_file_path: text('pdf_file_path'), // Nullable - only set when conversion is completed
  error_message: text('error_message'), // Nullable - only set when conversion fails
  created_at: timestamp('created_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'), // Nullable - only set when conversion is completed
});

// Image uploads table
export const imageUploadsTable = pgTable('image_uploads', {
  id: serial('id').primaryKey(),
  original_name: text('original_name').notNull(),
  file_path: text('file_path').notNull(),
  file_size: integer('file_size').notNull(),
  format: imageFormatEnum('format').notNull(),
  order_index: integer('order_index').notNull(),
  conversion_id: integer('conversion_id').notNull(),
  uploaded_at: timestamp('uploaded_at').defaultNow().notNull(),
});

// Relations
export const pdfConversionsRelations = relations(pdfConversionsTable, ({ many }) => ({
  images: many(imageUploadsTable),
}));

export const imageUploadsRelations = relations(imageUploadsTable, ({ one }) => ({
  conversion: one(pdfConversionsTable, {
    fields: [imageUploadsTable.conversion_id],
    references: [pdfConversionsTable.id],
  }),
}));

// TypeScript types for the table schemas
export type PdfConversion = typeof pdfConversionsTable.$inferSelect;
export type NewPdfConversion = typeof pdfConversionsTable.$inferInsert;

export type ImageUpload = typeof imageUploadsTable.$inferSelect;
export type NewImageUpload = typeof imageUploadsTable.$inferInsert;

// Important: Export all tables and relations for proper query building
export const tables = {
  pdfConversions: pdfConversionsTable,
  imageUploads: imageUploadsTable,
};