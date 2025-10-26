import prisma from "../configs/database.js";
import { createAlias } from "../utils/createAlias.js";
import { processAndStoreImages } from "../helpers/imageHelper.js";

export const createArchive = async (archiveData, file) => {
  const { title, introtext, fulltext, publish_date, ...rest } = archiveData;

  let processedImageUrl = null;
  if (file) {
    const { path: imagePath, filename, originalname } = file;

    // Process and store images
    processedImageUrl = await processAndStoreImages(
      imagePath,
      filename,
      originalname,
      "archive"
    );
  }

  let formattedDate = null;
  if (publish_date) {
    formattedDate = new Date(publish_date).toISOString();
    // Will throw if invalid
  }

  await prisma.aps2024_archive.create({
    data: {
      ...rest,
      title: title,
      alias: createAlias(title),
      introtext: cleanHtmlContent(introtext),
      fulltext: cleanHtmlContent(fulltext),
      url: processedImageUrl,
      views: 0,
      publish_date: formattedDate,
    },
  });
};

function cleanHtmlContent(htmlContent) {
  if (!htmlContent || typeof htmlContent !== "string") {
    return htmlContent;
  }

  // Remove style attributes
  const styleRegex = /\s+style\s*=\s*["'][^"']*["']/gi;
  let cleaned = htmlContent.replace(styleRegex, "");

  // Remove <strong>, <i>, and <h1>-<h6> tags (both opening and closing)
  const tagsRegex = /<\/?(strong|i|h[1-6])[^>]*>/gi;
  cleaned = cleaned.replace(tagsRegex, "");

  return cleaned;
}
