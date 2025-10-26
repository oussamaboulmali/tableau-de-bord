import sharp from "sharp";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { pipeline } from "stream/promises";
import os from "os";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Performance optimizations
const CONCURRENT_WORKERS = Math.min(4, os.cpus().length);
const workerPool = [];
let currentWorker = 0;

const baseDir =
  process.env.PROJECT_ENV === "local"
    ? `uploads/`
    : `${process.env.IMAGE_PATH || "uploads/"}`;

// Ensure directory exists before writing files
const ensureDirectoryExists = async (dirPath) => {
  if (!dirPath) {
    console.error("Invalid directory path: dirPath is undefined or null");
    return;
  }
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
  }
};

// Initialize worker pool for better performance
const initializeWorkerPool = () => {
  for (let i = 0; i < CONCURRENT_WORKERS; i++) {
    workerPool.push({
      busy: false,
      worker: null,
    });
  }
};

// Get available worker from pool
const getAvailableWorker = () => {
  const availableWorker = workerPool.find((w) => !w.busy);
  if (availableWorker) return availableWorker;

  // If no available worker, use round-robin
  const worker = workerPool[currentWorker];
  currentWorker = (currentWorker + 1) % CONCURRENT_WORKERS;
  return worker;
};

// Helper function to delete temp file with existence check
const deleteTempFile = async (filePath) => {
  try {
    // Check if file exists before trying to delete
    await fs.access(filePath);
    await fs.unlink(filePath);
    console.log(`Temp file deleted: ${filePath}`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(`Error deleting temp file ${filePath}:`, error);
    }
    // Don't log ENOENT errors as they're expected when file doesn't exist
  }
};

// FIXED: Check if image needs processing based on size, format, and watermark requirement
const shouldProcessImage = async (imagePath, originalname, is_watermarked) => {
  try {
    const stats = await fs.stat(imagePath);
    const metadata = await sharp(imagePath).metadata();

    // Skip processing for GIFs (they lose animation when converted)
    if (metadata.format === "gif") {
      return false;
    }

    // FORCE processing if watermark is needed, regardless of size or format
    if (is_watermarked) {
      return true;
    }

    // Skip processing for very small images (less than 400KB) if no watermark needed
    if (stats.size < 400 * 1024) {
      return false;
    }

    // Skip processing for already optimized WebP images under 2MB if no watermark needed
    if (metadata.format === "webp" && stats.size < 2 * 1024 * 1024) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error checking if image needs processing:", error);
    return true; // Process by default if we can't determine
  }
};

// Calculate timeout based on file size
const calculateTimeout = (fileSizeBytes) => {
  const fileSizeMB = fileSizeBytes / (1024 * 1024);

  // Base timeout of 15 seconds + 10 seconds per MB
  const timeout = Math.max(30000, 15000 + fileSizeMB * 10000);

  // Cap at 2 minutes for very large files
  return Math.min(timeout, 120000);
};

// FIXED: Optimized image processing with better logic
export const processAndStoreImages = async (
  imagePath,
  filename,
  originalname,
  folder,
  is_watermarked
) => {
  if (!imagePath || !filename || !folder) {
    throw new ErrorHandler(401, "Required parameters missing");
  }

  try {
    console.log("Processing image:", originalname);

    const fullOriginalDir = path.join(baseDir, folder);
    await ensureDirectoryExists(fullOriginalDir);

    // Check if image needs processing
    const needsProcessing = await shouldProcessImage(
      imagePath,
      originalname,
      is_watermarked
    );

    if (!needsProcessing) {
      // FIXED: For images that don't need processing, keep original extension
      const originalExt = path.extname(originalname);
      const originalPath = path.join(
        fullOriginalDir,
        `${filename}${originalExt}`
      );

      try {
        // Use stream for copying
        await pipeline(
          fsSync.createReadStream(imagePath),
          fsSync.createWriteStream(originalPath)
        );

        // Delete temp file after successful copy
        await deleteTempFile(imagePath);

        return `${folder}/${path.basename(originalPath)}`;
      } catch (error) {
        // Delete temp file even if copy fails
        await deleteTempFile(imagePath);
        throw error;
      }
    }

    // Get file size for timeout calculation
    const stats = await fs.stat(imagePath);
    const timeoutDuration = calculateTimeout(stats.size);

    console.log(
      `Processing ${stats.size} byte image with ${timeoutDuration}ms timeout`
    );

    // Process with worker pool for better performance
    return new Promise((resolve, reject) => {
      const workerSlot = getAvailableWorker();
      workerSlot.busy = true;

      // Create new worker for each task to avoid memory issues
      const worker = new Worker(new URL(import.meta.url), {
        workerData: {
          imagePath,
          filename,
          originalname, // Pass originalname for logging
          folder,
          is_watermarked,
          outputExtension: "webp", // Always convert to WebP when processing
          fileSize: stats.size,
        },
      });

      const timeoutId = setTimeout(() => {
        worker.terminate();
        workerSlot.busy = false;
        // Delete temp file on timeout
        deleteTempFile(imagePath);
        reject(
          new ErrorHandler(
            408,
            `Image processing timeout after ${timeoutDuration}ms`
          )
        );
      }, timeoutDuration);

      worker.once("message", (result) => {
        clearTimeout(timeoutId);
        worker.terminate();
        workerSlot.busy = false;

        if (result.success) {
          // Delete temp file after successful processing
          deleteTempFile(imagePath);
          resolve(`${folder}/${path.basename(result.outputPath)}`);
        } else {
          // Delete temp file on processing error
          deleteTempFile(imagePath);
          reject(new ErrorHandler(422, result.error));
        }
      });

      worker.once("error", (error) => {
        clearTimeout(timeoutId);
        worker.terminate();
        workerSlot.busy = false;
        // Delete temp file on worker error
        deleteTempFile(imagePath);
        reject(new ErrorHandler(500, `Worker error: ${error.message}`));
      });
    });
  } catch (error) {
    console.error("Optimized image processing error:", error);
    // Ensure temp file is deleted even on unexpected errors
    await deleteTempFile(imagePath);
    throw error;
  }
};

// ENHANCED: Worker thread with better error handling and performance
if (!isMainThread) {
  const processImageWorker = async () => {
    const {
      imagePath,
      filename,
      originalname,
      folder,
      is_watermarked,
      outputExtension,
      fileSize,
    } = workerData;

    try {
      const startTime = Date.now();
      // Verify the input file exists and is readable
      try {
        await fs.access(imagePath, fs.constants.R_OK);
      } catch (error) {
        throw new Error(`Input file not accessible: ${imagePath}`);
      }

      // Get metadata first to determine processing strategy
      const metadata = await sharp(imagePath).metadata();

      // Configure Sharp for memory efficiency
      sharp.cache(false); // Disable cache to save memory
      sharp.concurrency(1); // Process one at a time in worker

      // Create transformer with progressive processing for large images
      let transformer = sharp(imagePath, {
        limitInputPixels: false, // Allow large images
        sequentialRead: true, // Better for large files
        failOnError: false, // Continue processing even with minor errors
      });

      // Optimize based on image size and format
      const isLargeImage = fileSize > 5 * 1024 * 1024; // 5MB threshold
      const needsResize = metadata.width > 2500 || metadata.height > 2500;

      if (needsResize) {
        const maxDimension = isLargeImage ? 2000 : 2500;
        transformer = transformer.resize(maxDimension, maxDimension, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }

      // FIXED: Configure WebP settings based on file size and ensure conversion
      const webpOptions = {
        quality: isLargeImage ? 80 : 90, // Lower quality for larger files
        effort: isLargeImage ? 3 : 4, // Less effort for larger files to speed up processing
        progressive: true, // Progressive encoding for better streaming
        force: true, // Force WebP conversion even if input is already WebP
      };

      transformer = transformer.webp(webpOptions);

      let processedBuffer = await transformer.toBuffer();

      // Apply watermark if needed
      if (is_watermarked) {
        const watermarkStart = Date.now();
        processedBuffer = await addWatermarkOptimized(processedBuffer);
        console.log(
          `Worker: Watermark applied in ${Date.now() - watermarkStart}ms`
        );
      }

      const fullOutputDir = path.join(baseDir, folder);
      await ensureDirectoryExists(fullOutputDir);

      // ENSURE: Output file always has .webp extension when processed
      const outputPath = path.join(
        fullOutputDir,
        `${filename}.${outputExtension}`
      );

      // Write file with error handling
      await fs.writeFile(outputPath, processedBuffer);

      const processingTime = Date.now() - startTime;
      console.log(`Worker: Total processing time: ${processingTime}ms`);

      parentPort.postMessage({
        success: true,
        outputPath,
        fileSize: processedBuffer.length,
        processingTime,
        originalFormat: metadata.format,
        outputFormat: outputExtension,
      });
    } catch (error) {
      console.error("Worker processing error:", error);
      parentPort.postMessage({
        success: false,
        error: `Processing failed: ${error.message}`,
      });
    }
  };

  processImageWorker();
}

// Add watermark to image (optimized version)
const addWatermarkOptimized = async (imageBuffer) => {
  try {
    const watermarkPath = process.env.WATERMARK_PATH;
    if (!watermarkPath) {
      console.warn("No watermark path specified");
      return imageBuffer;
    }

    // Check if the watermark file exists
    try {
      await fs.access(watermarkPath);
    } catch (error) {
      console.warn(`Watermark file not found: ${watermarkPath}`);
      return imageBuffer;
    }

    // Get dimensions of both the image and watermark
    const imageMetadata = await sharp(imageBuffer).metadata();
    const watermarkMetadata = await sharp(watermarkPath).metadata();

    const { width: imageWidth, height: imageHeight } = imageMetadata;
    const { width: wmWidth, height: wmHeight } = watermarkMetadata;

    if (!imageWidth || !imageHeight || !wmWidth || !wmHeight) {
      throw new ErrorHandler(422, "Unable to get image metadata");
    }

    const watermarkImage = await sharp(watermarkPath)
      .resize({
        width: imageWidth,
        height: imageHeight,
        fit: "fill", // Stretch to fill entire image
      })
      .toBuffer();
    // Add watermark to image - centered with low opacity
    return sharp(imageBuffer, { sequentialRead: true })
      .composite([
        {
          input: watermarkImage,
          top: 0,
          left: 0,
          blend: "over",
          opacity: 0.15, // Very low opacity (15%) so it's subtle
        },
      ])
      .toBuffer();
  } catch (error) {
    console.error("Watermark error:", error);
    return imageBuffer; // Return original image if watermarking fails
  }
};

// Initialize worker pool on module load
initializeWorkerPool();
