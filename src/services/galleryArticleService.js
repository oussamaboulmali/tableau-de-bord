// Import required modules
import prisma from "../configs/database.js";
import { infoLogger } from "../utils/logger.js";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { processAndStoreImages } from "../helpers/imageHelper.js";

// Initialize logger
const logger = infoLogger("galerie_articles");

export const uploadGallery = async (galleryData, logData) => {
  const {
    files = [],
    name,
    images = [],
    type,
    description,
    id_session,
    id_user,
    created_by,
    ...rest
  } = galleryData;

  // Validate gallery has at least one image
  if (files.length === 0 && images.length === 0) {
    logger.error({
      ...logData,
      message: "Une tentative de créer une galerie sans images.",
    });
    throw new ErrorHandler(
      401,
      "Vous ne pouvez pas créer une galerie sans images"
    );
  }

  // Validate all provided image IDs exist
  await validateExistingImages(images, logData);

  // Process new images
  const newImageIDs = await processNewImages(
    files,
    {
      name,
      type,
      id_session,
      id_user,
      created_by,
      description,
      ...rest,
    },
    logData
  );

  const allImageIDs = [...newImageIDs, ...images];

  // Create gallery with all images
  const gallery = await prisma.aps2024_gallery.create({
    data: {
      id_session,
      id_user,
      name,
      created_by,
      is_watermarked: type,
      description,
      aps2024_gallery_image: {
        createMany: {
          data: allImageIDs.map((imageId) => ({
            id_image: imageId,
          })),
        },
      },
    },
    select: {
      id_gallery: true,
    },
  });
  return {
    id_gallery: Number(gallery.id_gallery),
  };
};

export const getAllGalleriesHaveNoArticles = async (data) => {
  const { pageSize, page } = data;

  const offset = (page - 1) * pageSize;
  const galleries = await prisma.aps2024_gallery.findMany({
    take: parseInt(pageSize),
    skip: parseInt(offset),
    orderBy: [
      {
        created_date: "desc",
      },
    ],
    include: {
      aps2024_gallery_image: {
        select: {
          aps2024_images: {
            select: {
              url: true,
            },
          },
        },
      },
    },
  });

  const galleriesCount = await prisma.aps2024_gallery.count();

  const galleriesFormatted = galleries.map((gallery) => {
    const { id_gallery, name, aps2024_gallery_image } = gallery;

    return {
      id_gallery: Number(id_gallery),
      name,
      url: aps2024_gallery_image[0]?.aps2024_images.url,
    };
  });

  return { galleries: galleriesFormatted, count: galleriesCount };
};

export const getAllGalleries = async (data) => {
  const { pageSize, page } = data;

  const offset = (page - 1) * pageSize;

  const galleries = await prisma.aps2024_gallery.findMany({
    take: parseInt(pageSize),
    skip: parseInt(offset),
    orderBy: [
      {
        created_date: "desc",
      },
    ],
    include: {
      aps2024_gallery_image: {
        select: {
          aps2024_images: {
            select: {
              url: true,
            },
          },
        },
      },
    },
  });

  const galleriesCount = await prisma.aps2024_gallery.count();

  const galleriesFormatted = galleries.map((gallery) => {
    const { id_gallery, name, aps2024_gallery_image } = gallery;

    return {
      id_gallery: Number(id_gallery),
      name,
      url: aps2024_gallery_image[0]?.aps2024_images.url,
    };
  });

  return { galleries: galleriesFormatted, count: galleriesCount };
};

export const getOneGallery = async ({ galleryId }) => {
  const gallery = await prisma.aps2024_gallery.findUnique({
    where: {
      id_gallery: galleryId,
    },
    include: {
      aps2024_gallery_image: {
        select: {
          aps2024_images: {
            select: {
              id_image: true,
              url: true,
              name: true,
              description: true,
            },
          },
        },
      },
    },
  });

  if (!gallery) {
    throw new ErrorHandler(404, "gallery inexistant.");
  }

  const { id_gallery, aps2024_gallery_image, id_session, ...rest } = gallery;

  return {
    id_gallery: Number(id_gallery),
    ...rest,
    images: aps2024_gallery_image.map((image) => ({
      id_image: Number(image.aps2024_images.id_image),
      url: image.aps2024_images.url,
      name: image.aps2024_images.name,
      description: image.aps2024_images.description,
    })),
  };
};

export const getOtherImagesOfGallery = async ({ galleryId }) => {
  const gallery = await prisma.aps2024_gallery.findUnique({
    where: {
      id_gallery: galleryId,
    },
  });

  if (!gallery) {
    throw new ErrorHandler(404, "gallery inexistant.");
  }

  const otherImages = await prisma.aps2024_images.findMany({
    where: {
      NOT: {
        aps2024_gallery_image: {
          some: {
            id_gallery: galleryId,
          },
        },
      },
      source: 0,
    },
    select: {
      id_image: true,
      url: true,
      name: true,
      description: true,
    },
    orderBy: {
      id_image: "desc",
    },
  });

  const imagesFormatted = otherImages.map((image) => {
    const { id_image, ...rest } = image;

    return {
      id_image: Number(id_image),
      ...rest,
    };
  });

  return imagesFormatted;
};

export const deleteGallery = async (galleryId, isConfirmed, logData) => {
  const existingGallery = await prisma.aps2024_gallery.findUnique({
    where: { id_gallery: galleryId },
  });

  if (!existingGallery) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'une galerie inexistante.
      Informations de débogage :
      ID de la galerie demandé : ${galleryId}`,
    });
    throw new ErrorHandler(401, "galerie inexistante");
  }

  if (!isConfirmed) {
    // test if gallery associated with an article
    const existingGalleryArticle = await prisma.aps2024_articles.findFirst({
      where: {
        id_gallery: galleryId,
      },
      select: {
        id_article: true,
        title: true,
      },
    });

    if (existingGalleryArticle) {
      logger.error({
        ...logData,
        message: `Une tentative de suppression d'une galerie associée à un article existant.
      Informations de débogage :
      gallery demandée : ${existingGallery.name}
      ID de l'article : ${existingGalleryArticle.id_article}
      Titre de l'article : ${existingGalleryArticle.title}`,
      });
      throw new ErrorHandler(
        401,
        "Vous ne pouvez pas supprimer cette galerie car un article y est associé."
      );
    }
  }

  await prisma.aps2024_gallery.delete({
    where: {
      id_gallery: galleryId,
    },
  });

  return { name: existingGallery.name };
};

// Service function to search for galleries based on text input matching gallery names
export const searchGalleries = async ({ searchText, pageSize, page }) => {
  // Calculate offset based on page and pageSize
  const offset = pageSize * (page - 1);

  if (searchText == "") {
    const { galleries, count } = await getAllGalleriesHaveNoArticles({
      pageSize,
      page,
    });
    return { galleries, count };
  }

  // Search for galleries by name with pagination
  const galleries = await prisma.aps2024_gallery.findMany({
    where: {
      name: {
        contains: searchText,
        mode: "insensitive", // Case-insensitive search
      },
    },
    take: pageSize, // Limit number of results per page
    skip: offset, // Skip results based on page and pageSize
    include: {
      aps2024_gallery_image: {
        select: {
          aps2024_images: {
            select: {
              url: true,
            },
          },
        },
      },
    },
  });

  // Get total count of results
  const totalCount = await prisma.aps2024_gallery.count({
    where: {
      name: {
        contains: searchText,
        mode: "insensitive", // Case-insensitive search
      },
    },
  });

  const galleriesFormatted = galleries.map((gallery) => {
    const { id_gallery, name, aps2024_gallery_image } = gallery;
    return {
      id_gallery: Number(id_gallery),
      name,
      url: aps2024_gallery_image[0]?.aps2024_images.url,
    };
  });

  return { galleries: galleriesFormatted, count: totalCount };
};

export const updateGallery = async (imageData, logData) => {
  const {
    galleryId,
    existedImages = [],
    removedImages = [],
    ...data
  } = imageData;

  const existingGallery = await prisma.aps2024_gallery.findUnique({
    where: { id_gallery: galleryId },
    select: {
      name: true,
    },
  });

  if (!existingGallery) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'une galerie qui n'existe pas.
      Informations de débogage :
      ID de l'image demandé : ${galleryId}`,
    });
    throw new ErrorHandler(401, "Gallery inexistante");
  }

  // Remove images
  await removeImageFromGallery(galleryId, removedImages, logData);

  // Add new images
  await checkGalleryHasImages(existedImages, galleryId, logData);

  // Create user-image relationships
  const createdData = existedImages.map((imageId) => ({
    id_image: imageId,
  }));

  delete data.id_session;

  // Update gallery data
  await prisma.aps2024_gallery.update({
    where: { id_gallery: galleryId },
    data: {
      ...data,
      modified_date: new Date(),
      aps2024_gallery_image: {
        createMany: {
          data: createdData,
        },
        deleteMany: {
          id_image: { in: removedImages.map((id) => id) },
        },
      },
    },
  });

  return {
    galleryName: existingGallery.name,
    addedImages: createdData,
    removedImages: removedImages,
  };
};

const removeImageFromGallery = async (
  galleryId,
  removedImages = [],
  logData
) => {
  for (const imageId of removedImages) {
    const existingGalleryImage = await prisma.aps2024_gallery_image.findFirst({
      where: { id_gallery: galleryId, id_image: imageId },
      select: {
        aps2024_images: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!existingGalleryImage) {
      logger.error({
        ...logData,
        message: `Une tentative de suppression d'une image d'une galerie qui ne le possède pas.
        Informations de débogage :
        ID de la galerie demandé : ${galleryId}
        ID de l'image demandé : ${imageId}`,
      });
      throw new ErrorHandler(401, "La galerie ne possède pas cette image.");
    }
  }
};

// Function to check if existing image exist in the gallery
const checkGalleryHasImages = async (existedImages, galleryId, logData) => {
  for (const imageId of existedImages) {
    const existingImage = await prisma.aps2024_images.findUnique({
      where: {
        id_image: imageId,
      },
      select: {
        name: true,
      },
    });

    if (!existingImage) {
      logger.error({
        ...logData,
        message: `Une tentative d'ajout d'une image inexistant à une galerie
        Informations de débogage :
        ID de la galerie demandé : ${galleryId}
        ID de l'image demandé : ${imageId}`,
      });
      throw new ErrorHandler(401, "L'un des image n'a pas été trouvé.");
    }

    const existingImageGallery = await prisma.aps2024_gallery_image.findFirst({
      where: {
        id_image: galleryId,
        id_gallery: imageId,
      },
    });

    if (existingImageGallery) {
      logger.error({
        ...logData,
        message: `Une tentative d'ajout d'une image à une galerie qui le possède déjà.
        Informations de débogage :
        ID de la galerie demandé : ${galleryId}
        ID de l'image demandé : ${imageId}
        Nom de l'image demandé : ${existingImage.name}`,
      });
      throw new ErrorHandler(401, "La galerie possède déjà l'un des image.");
    }
  }
};

// Helper function to process new image uploads
const processNewImages = async (files = [], imageData, logData) => {
  if (files.length === 0) return [];

  const imageIds = [];

  for (const file of files) {
    const { path: imagePath, filename, originalname } = file;
    console.log("Processing image:", originalname);

    const data = await uploadImagesGallery(
      {
        ...imageData,
        originalname,
        imagePath,
        filename,
      },
      logData
    );

    console.log("Image processed:", originalname);
    imageIds.push(data.id_image);
  }

  return imageIds;
};

const uploadImagesGallery = async (imageData, logData) => {
  const { name, originalname, imagePath, filename, type, created_by, ...data } =
    imageData;

  // Process the image file
  const processedImageUrl = await processAndStoreImages(
    imagePath,
    filename,
    originalname,
    "article",
    type
  );

  const image = await prisma.aps2024_images.create({
    data: {
      name: name,
      url: processedImageUrl,
      source: 0,
      created_by,
      ...data,
    },
    select: {
      id_image: true,
      url: true,
    },
  });

  return {
    ...image,
    id_image: Number(image.id_image),
  };
};

const validateExistingImages = async (imageIds = [], logData) => {
  for (const imageId of imageIds) {
    const existingImage = await prisma.aps2024_images.findUnique({
      where: { id_image: imageId },
    });

    if (!existingImage) {
      logger.error({
        ...logData,
        message: `Une tentative de créer une galerie avec une image inexistante.
        Informations de débogage :
        ID de l'image demandé : ${imageId}`,
      });
      throw new ErrorHandler(401, "Image inexistante");
    }
  }
};
