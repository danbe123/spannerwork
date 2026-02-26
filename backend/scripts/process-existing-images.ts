/**
 * Process Existing Images Script
 *
 * Generates optimized versions (AVIF, WebP, JPEG) for all existing uploads
 * that don't already have optimized versions.
 *
 * Usage: npx tsx scripts/process-existing-images.ts
 */

import { imageProcessorService } from '../src/services/image-processor.service.js';

async function main() {
  console.log('Starting image processing migration...\n');

  const startTime = Date.now();
  const result = await imageProcessorService.processExistingImages();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n========================================');
  console.log('Image processing complete!');
  console.log('========================================');
  console.log(`Processed: ${result.processed} images`);
  console.log(`Errors: ${result.errors} images`);
  console.log(`Time: ${elapsed}s`);
}

main().catch(console.error);
