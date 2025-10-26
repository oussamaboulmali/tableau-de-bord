// Import required modules
import prisma from "../configs/database.js";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";
import fs from "fs";
import path from "path";

import { processAndStoreImages } from "../helpers/imageHelper.js";

// Initialize logger
const logger = infoLogger("images");

// Function to upload an image
export const uploadImage = async (imageData, logData) => {
  const { name, originalname, imagePath, filename, type, ...data } = imageData;

  // Process and store images
  const processedImageUrl = await processAndStoreImages(
    imagePath,
    filename,
    originalname,
    "article",
    type
  );

  // Create new image record in the database
  const image = await prisma.aps2024_images.create({
    data: {
      name: name,
      url: processedImageUrl,
      source: 0,
      ...data,
    },
    select: {
      id_image: true,
      url: true,
    },
  });

  // Return the created image record
  return {
    ...image,
    id_image: Number(image.id_image),
  };
};

export const getAllImages = async () => {
  const images = await prisma.aps2024_images.findMany({
    orderBy: [
      {
        created_date: "desc",
      },
    ],
    where: {
      source: 0,
    },
    select: {
      id_image: true,
      name: true,
      url: true,
      description: true,
    },
  });

  const imagesFormatted = images.map((image) => {
    const { id_image, ...rest } = image;
    return {
      id_image: Number(id_image),
      ...rest,
    };
  });

  return imagesFormatted;
};

export const getAllImagesWithPaginations = async (data) => {
  const { pageSize, page } = data;

  const offset = (page - 1) * pageSize;

  const images = await prisma.aps2024_images.findMany({
    take: parseInt(pageSize),
    skip: parseInt(offset),
    orderBy: [
      {
        created_date: "desc",
      },
    ],
    where: {
      source: 0,
    },
    select: {
      id_image: true,
      name: true,
      url: true,
      description: true,
    },
  });

  const imagesCount = await prisma.aps2024_images.count({
    where: {
      source: 0,
    },
  });

  const imagesFormatted = images.map((image) => {
    const { id_image, ...rest } = image;
    return {
      id_image: Number(id_image),
      ...rest,
    };
  });

  return { images: imagesFormatted, count: imagesCount };
};

export const getOneImage = async ({ imageId }) => {
  const image = await prisma.aps2024_images.findUnique({
    where: {
      id_image: imageId,
    },
  });

  if (!image) {
    throw new ErrorHandler(404, "Image inexistant.");
  }

  const { id_session, id_image, ...rest } = image;

  return {
    id_image: Number(id_image),
    ...rest,
  };
};

export const deleteImage = async (imageId, logData) => {
  const existingImage = await prisma.aps2024_images.findUnique({
    where: { id_image: imageId },
    select: {
      url: true,
      name: true,
      aps2024_articles: {
        select: {
          id_article: true,
          title: true,
        },
      },
      aps2024_gallery_image: {
        select: {
          id_gallery: true,
          aps2024_gallery: {
            select: {
              name: true,
            },
          },
        },
      },
      aps2024_banners: {
        select: {
          id_banner: true,
          name: true,
        },
      },
      aps2024_cahiers_aps: {
        select: {
          id_cahier: true,
          name: true,
        },
      },
      aps2024_dossiers: {
        select: {
          id_dossier: true,
          name: true,
        },
      },
      aps2024_infographies: {
        select: {
          id_infographie: true,
          name: true,
        },
      },
      aps2024_home_gallery: {
        select: {
          id_home_gallery: true,
          name: true,
        },
      },
      aps2024_videos: {
        select: {
          id_video: true,
          name: true,
        },
      },
    },
  });

  if (!existingImage) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'une image inexistante.
      Informations de débogage :
      ID de l'image demandé : ${imageId}`,
    });
    throw new ErrorHandler(400, "image inexistante");
  }

  // test if image associated with an article
  if (existingImage.aps2024_articles.length > 0) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'une image associée à un article existant.
      Informations de débogage :
      Image demandée : ${existingImage.name}
      ID de l'article : ${existingImage.aps2024_articles.map(
        (id) => id.id_article
      )}
      Titre de l'article : ${existingImage.aps2024_articles.map(
        (title) => title.title
      )}`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas supprimer cette image car un article y est associé."
    );
  }

  if (existingImage.aps2024_gallery_image.length > 0) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'une image associée à une galerie d'article existant.
      Informations de débogage :
      Image demandée : ${existingImage.name}
      ID de la galerie d'article : ${existingImage.aps2024_gallery_image.map(
        (id) => id.id_gallery
      )}
      Nom de la galerie d'article : ${existingImage.aps2024_gallery_image.map(
        (gallery) => gallery.aps2024_gallery.name
      )}`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas supprimer cette image car une galerie d'article y est associé."
    );
  }

  if (existingImage.aps2024_dossiers.length > 0) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'une image associée à une dossier existant.
      Informations de débogage :
      Image demandée : ${existingImage.name}
      ID du dossier : ${existingImage.aps2024_dossiers.map(
        (id) => id.id_dossier
      )}
      Titre du dossier : ${existingImage.aps2024_dossiers.map(
        (name) => name.name
      )}`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas supprimer cette image car une dossier y est associé."
    );
  }

  if (existingImage.aps2024_banners.length > 0) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'une image associée à une bannière existant.
      Informations de débogage :
      Image demandée : ${existingImage.name}
      ID de la bannière : ${existingImage.aps2024_banners.map(
        (id) => id.id_banner
      )}
      Titre de la bannière : ${existingImage.aps2024_banners.map(
        (name) => name.name
      )}`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas supprimer cette image car une bannière y est associé."
    );
  }

  if (existingImage.aps2024_infographies.length > 0) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'une image associée à une inforgraphie existant.
      Informations de débogage :
      Image demandée : ${existingImage.name}
      ID de l'inforgraphie : ${existingImage.aps2024_infographies.map(
        (id) => id.id_infographie
      )}
      Titre de l'inforgraphie : ${existingImage.aps2024_infographies.map(
        (name) => name.name
      )}`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas supprimer cette image car une inforgraphie y est associé."
    );
  }

  if (existingImage.aps2024_cahiers_aps) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'une image associée à un cahier multimédia mult existant.
      Informations de débogage :
      Image demandée : ${existingImage.name}
      ID du cahier : ${existingImage.aps2024_cahiers_aps.id_cahier}
      Titre du cahier : ${existingImage.aps2024_cahiers_aps.name}`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas supprimer cette image car un cahier multimédia y est associé."
    );
  }

  if (existingImage.aps2024_videos.length > 0) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'une image associée à une vidéo existant.
      Informations de débogage :
      Image demandée : ${existingImage.name}
      ID video : ${existingImage.aps2024_videos.map((id) => id.id_video)}
      Titre video : ${existingImage.aps2024_videos.map((name) => name.name)}`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas supprimer cette image car une vidéo y est associé."
    );
  }

  if (existingImage.aps2024_home_gallery) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'une image associée à une galerie photo existant.
      Informations de débogage :
      Image demandée : ${existingImage.name}
      ID de la galerie photo : ${existingImage.aps2024_home_gallery.id_home_gallery}
      Titre de la galerie photo : ${existingImage.aps2024_home_gallery.name}`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas supprimer cette image car une galerie photo y est associé."
    );
  }

  // Delete the original image file from the server
  const imagePaths = await findImagePaths(existingImage.url);

  if (imagePaths.length === 0) {
    logger.error({
      ...logData,
      message: `Tentative de suppression d'une image qui n'existe pas dans les fichiers.
      Informations de débogage :
      ID de l'image demandé : ${imageId}
      URL de l'image : ${existingImage.url}`,
    });
    throw new ErrorHandler(400, "Image non trouvée dans les fichiers.");
  }

  // Delete files in parallel
  const deletePromises = imagePaths.map(async (imagePath) => {
    try {
      await fs.promises.unlink(imagePath);
      console.log(`Deleted: ${imagePath}`);
    } catch (err) {
      console.error(`Erreur lors de la suppression de ${imagePath}:`, err);
    }
  });

  await Promise.all(deletePromises);

  await prisma.aps2024_images.delete({
    where: {
      id_image: imageId,
    },
  });

  return { name: existingImage.name, url: existingImage.url };
};

// Service function to search for images based on text input matching image names and descriptions
export const searchImages = async ({ searchText, pageSize, page }) => {
  // Calculate offset based on page and pageSize
  const offset = pageSize * (page - 1);

  if (searchText == "") {
    const { images, count } = await getAllImagesWithPaginations({
      pageSize,
      page,
    });
    return { images, count };
  }

  // Search for images by name and description with pagination
  const images = await prisma.aps2024_images.findMany({
    where: {
      source: 0,
      OR: [
        {
          name: {
            contains: searchText,
            mode: "insensitive", // Case-insensitive search
          },
        },
        {
          description: {
            contains: searchText,
            mode: "insensitive", // Case-insensitive search
          },
        },
      ],
    },
    take: pageSize, // Limit number of results per page
    skip: offset, // Skip results based on page and pageSize
    distinct: "id_image",
    select: {
      id_image: true,
      name: true,
      url: true,
      description: true,
    },
  });

  // Get total count of results
  const totalCount = await prisma.aps2024_images.count({
    where: {
      source: 0,
      OR: [
        {
          name: {
            contains: searchText,
            mode: "insensitive", // Case-insensitive search
          },
        },
        {
          description: {
            contains: searchText,
            mode: "insensitive", // Case-insensitive search
          },
        },
      ],
    },
  });

  const imagesFormatted = images.map((image) => {
    const { id_image, ...rest } = image;
    return {
      id_image: Number(id_image),
      ...rest,
    };
  });

  return { images: imagesFormatted, count: totalCount };
};

export const updateImage = async (imageData, logData) => {
  const { imageId, ...data } = imageData;

  const existingImage = await prisma.aps2024_images.findUnique({
    where: { id_image: imageId },
  });

  if (!existingImage) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'une image qui n'existe pas.
      Informations de débogage :
      ID de l'image demandé : ${imageId}`,
    });
    throw new ErrorHandler(400, "Image inexistante");
  }

  // Update image data
  await prisma.aps2024_images.update({
    where: { id_image: imageId },
    data: {
      ...data,
      modified_date: new Date(),
    },
  });

  return {
    imageName: existingImage.name,
  };
};

// Helper function to get the full paths of all instances of the image files
const getImagePaths = (imageUrl) => {
  const uploadDir =
    process.env.PROJECT_ENV == "local" ? "uploads" : process.env.IMAGE_PATH;
  const filename = path.basename(imageUrl);
  const dimensions = ["small", "medium", "large", "original"];
  return dimensions.map((folder) => path.join(uploadDir, folder, filename));
};

async function findImagePaths(imagePathFragment) {
  const uploadDir =
    process.env.PROJECT_ENV === "local" ? "uploads" : process.env.IMAGE_PATH;

  // Extract just the filename from the path fragment
  const imageFilename = path.basename(imagePathFragment);

  try {
    // Check if directory exists
    await fs.promises.access(uploadDir);
  } catch (error) {
    console.error(`Directory not found: ${uploadDir}`);
    return [];
  }

  const foundPaths = [];
  const stack = [uploadDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();

    try {
      const files = await fs.promises.readdir(currentDir);
      for (const file of files) {
        const fullPath = path.join(currentDir, file);

        try {
          const stat = await fs.promises.stat(fullPath);

          if (stat.isDirectory()) {
            stack.push(fullPath);
          } else if (file === imageFilename) {
            // Only checking filename match, not the entire path
            foundPaths.push(fullPath);
          }
        } catch (error) {
          console.error(`Error accessing ${fullPath}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentDir}:`, error);
    }
  }

  return foundPaths;
}

export const getAllIndexes = async () => {
  const indexes = await prisma.aps2024_index.findMany({
    orderBy: [
      {
        created_date: "desc",
      },
    ],
    select: {
      id_index: true,
      name: true,
    },
  });

  const indexesFormatted = indexes.map((index) => {
    const { id_index, ...rest } = index;
    return {
      id_index: Number(id_index),
      ...rest,
    };
  });

  return indexesFormatted;
};
