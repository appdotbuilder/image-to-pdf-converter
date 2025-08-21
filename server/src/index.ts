import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schema types
import {
  createConversionInputSchema,
  uploadImageInputSchema,
  reorderImagesInputSchema,
  updateConversionInputSchema,
  processConversionInputSchema
} from './schema';

// Import handlers
import { createConversion } from './handlers/create_conversion';
import { uploadImage } from './handlers/upload_image';
import { reorderImages } from './handlers/reorder_images';
import { updateConversion } from './handlers/update_conversion';
import { processConversion } from './handlers/process_conversion';
import { getConversion } from './handlers/get_conversion';
import { getPdfFile } from './handlers/get_pdf_file';
import { deleteImage } from './handlers/delete_image';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check endpoint
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Create a new PDF conversion session
  createConversion: publicProcedure
    .input(createConversionInputSchema)
    .mutation(({ input }) => createConversion(input)),

  // Upload an image to a conversion session
  uploadImage: publicProcedure
    .input(uploadImageInputSchema)
    .mutation(({ input }) => uploadImage(input)),

  // Reorder images within a conversion session
  reorderImages: publicProcedure
    .input(reorderImagesInputSchema)
    .mutation(({ input }) => reorderImages(input)),

  // Update conversion page settings
  updateConversion: publicProcedure
    .input(updateConversionInputSchema)
    .mutation(({ input }) => updateConversion(input)),

  // Process conversion to generate PDF
  processConversion: publicProcedure
    .input(processConversionInputSchema)
    .mutation(({ input }) => processConversion(input)),

  // Get conversion details with images
  getConversion: publicProcedure
    .input(z.object({ conversionId: z.number() }))
    .query(({ input }) => getConversion(input.conversionId)),

  // Get PDF file for download
  getPdfFile: publicProcedure
    .input(z.object({ conversionId: z.number() }))
    .query(({ input }) => getPdfFile(input.conversionId)),

  // Delete an uploaded image
  deleteImage: publicProcedure
    .input(z.object({ imageId: z.number() }))
    .mutation(({ input }) => deleteImage(input.imageId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();