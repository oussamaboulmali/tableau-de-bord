import prisma from "../configs/database.js";
import { processAndStoreImages } from "../helpers/imageHelper.js";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { createAlias } from "../utils/createAlias.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";
import { Buffer } from "buffer";

const logger = infoLogger("galeries");

export const getAllGallery = async () => {
  const homeGalleries = await prisma.aps2024_home_gallery.findMany({
    orderBy: [
      {
        created_date: "desc",
      },
    ],
    include: {
      aps2024_featured_image: {
        select: {
          url: true,
        },
      },
      aps2024_images: {
        select: {
          url: true,
        },
      },
    },
  });
  const homeGalleryFormatted = homeGalleries.map((galerie) => {
    const {
      id_home_gallery,
      aps2024_images,
      aps2024_featured_image,
      id_session,
      id_user,
      featured_image_id,
      ...rest
    } = galerie;
    return {
      id_home_gallery: Number(id_home_gallery),
      featured_image: aps2024_featured_image.url,
      // images:aps2024_images.map((image) => ({
      //   url: image.url})),
      ...rest,
    };
  });

  return homeGalleryFormatted;
};

export const getHomePageGalleries = async () => {
  // Only consider published, non-main homeGalleries

  // 1. Get pinned homeGalleries for positions 1-4
  const pinnedGalleries = await prisma.aps2024_home_gallery.findMany({
    where: {
      is_publish: true,
      position: { not: null },
    },
    orderBy: { position: "asc" },
    select: {
      id_home_gallery: true,
      name: true,
      description: true,
      position: true,
      publish_date: true,
      aps2024_featured_image: {
        select: {
          url: true,
        },
      },
    },
  });

  // Create a map to track which positions are filled
  const filledPositions = new Map();
  pinnedGalleries.forEach((galerie) => {
    if (galerie.position >= 1 && galerie.position <= 4) {
      filledPositions.set(galerie.position, galerie);
    }
  });

  // 2. Get unpinned homeGalleries to fill remaining positions
  const neededUnpinnedCount = 4 - filledPositions.size;
  let unpinnedGalleries = [];

  if (neededUnpinnedCount > 0) {
    unpinnedGalleries = await prisma.aps2024_home_gallery.findMany({
      where: {
        is_publish: true,
        position: null,
      },
      orderBy: { publish_date: "desc" },
      take: neededUnpinnedCount,
      select: {
        id_home_gallery: true,
        name: true,
        description: true,
        position: true,
        publish_date: true,
        aps2024_featured_image: {
          select: {
            url: true,
          },
        },
      },
    });
  }

  // 3. Merge results to create final ordered list
  const finalGalleries = [];

  // First add pinned homeGalleries to their positions
  for (let position = 1; position <= 4; position++) {
    if (filledPositions.has(position)) {
      finalGalleries[position - 1] = filledPositions.get(position);
    }
  }

  // Then fill empty positions with unpinned homeGalleries
  let unpinnedIndex = 0;
  for (let position = 1; position <= 4; position++) {
    if (
      !filledPositions.has(position) &&
      unpinnedIndex < unpinnedGalleries.length
    ) {
      finalGalleries[position - 1] = unpinnedGalleries[unpinnedIndex];
      unpinnedIndex++;
    }
  }

  const homeGalleryFormatted = finalGalleries.map((galerie) => {
    const { id_home_gallery, aps2024_featured_image, ...rest } = galerie;
    return {
      id_home_gallery: Number(id_home_gallery),
      featured_image: aps2024_featured_image.url,
      is_pinned: rest.position ? true : false,
      ...rest,
    };
  });

  return homeGalleryFormatted;
};

export const getPinnedGallery = async () => {
  const homeGalleries = await prisma.aps2024_home_gallery.findMany({
    orderBy: [
      {
        position: "asc",
      },
    ],
    where: {
      position: { not: null },
      is_publish: true,
    },
    select: {
      id_home_gallery: true,
      name: true,
      description: true,
      position: true,
      created_date: true,
      aps2024_featured_image: {
        select: {
          url: true,
        },
      },
    },
  });

  const homeGalleryFormatted = homeGalleries.map((galerie) => {
    const { id_home_gallery, aps2024_featured_image, ...rest } = galerie;
    return {
      id_home_gallery: Number(id_home_gallery),
      featured_image: aps2024_featured_image.url,
      ...rest,
    };
  });

  return homeGalleryFormatted;
};

export const getAllGalleryWithPaginations = async (data) => {
  const { pageSize, page, order = { created_date: "desc" } } = data;

  const offset = (page - 1) * pageSize;

  const homeGalleries = await prisma.aps2024_home_gallery.findMany({
    take: parseInt(pageSize),
    skip: parseInt(offset),
    orderBy: [order],
    include: {
      aps2024_featured_image: {
        select: {
          url: true,
        },
      },
    },
  });

  const galleriesCount = await prisma.aps2024_home_gallery.count();

  const homeGalleryFormatted = homeGalleries.map((galerie) => {
    const {
      id_home_gallery,
      aps2024_featured_image,
      featured_image_id,
      id_session,
      id_user,
      id_image,
      ...rest
    } = galerie;
    return {
      id_home_gallery: Number(id_home_gallery),
      featured_image: aps2024_featured_image.url,
      ...rest,
    };
  });

  return { homeGalleries: homeGalleryFormatted, count: galleriesCount };
};

export const getOtherGalleriesPublished = async (data) => {
  const {
    pageSize = 10,
    page = 1,
    order = { created_date: "desc" },
    galleryId,
  } = data;

  const offset = (page - 1) * pageSize;
  const homeGalleries = await prisma.aps2024_home_gallery.findMany({
    take: parseInt(pageSize),
    skip: parseInt(offset),
    orderBy: [order],
    where: {
      NOT: {
        id_home_gallery: galleryId,
      },
      is_publish: true,
    },
    include: {
      aps2024_featured_image: {
        select: {
          url: true,
        },
      },
    },
  });

  const galleryCount = await prisma.aps2024_home_gallery.count({
    where: {
      NOT: {
        id_home_gallery: galleryId,
      },
      is_publish: true,
    },
  });

  const galleriesFormatted = homeGalleries.map((galerie) => {
    const {
      id_home_gallery,
      aps2024_featured_image,
      id_session,
      id_user,
      id_image,
      featured_image_id,
      ...rest
    } = galerie;
    return {
      id_home_gallery: Number(id_home_gallery),
      featured_image: aps2024_featured_image.url,
      ...rest,
    };
  });

  return {
    homeGalleries: galleriesFormatted,
    count: galleryCount,
  };
};

export const getOneGallery = async ({ galleryId }) => {
  const galerie = await prisma.aps2024_home_gallery.findUnique({
    where: {
      id_home_gallery: galleryId,
    },
    include: {
      aps2024_featured_image: {
        select: {
          id_image: true,
          url: true,
        },
      },
      aps2024_images: {
        select: {
          id_image: true,
          url: true,
        },
      },
    },
  });

  if (!galerie) {
    throw new ErrorHandler(404, "galerie inexistant.");
  }

  const {
    id_home_gallery,
    id_image,
    id_session,
    featured_image_id,
    aps2024_images,
    aps2024_featured_image,
    ...rest
  } = galerie;

  return {
    id_home_gallery: Number(id_home_gallery),
    ...rest,
    featured_image: {
      id_image: Number(aps2024_featured_image.id_image),
      url: aps2024_featured_image.url,
    },
    images: aps2024_images.map((image) => ({
      id_image: Number(image.id_image),
      url: image.url,
    })),
  };
};

export const searchGallery = async (data) => {
  const { searchText, pageSize, page, order = { created_date: "desc" } } = data;
  // Calculate offset based on page and pageSize
  const offset = pageSize * (page - 1);

  if (searchText == "") {
    const { homeGalleries, count } = await getAllGalleryWithPaginations({
      pageSize,
      page,
      order,
    });
    return { homeGalleries, count };
  }
  // Search for tag by name with pagination
  const homeGalleries = await prisma.aps2024_home_gallery.findMany({
    where: {
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
    distinct: "id_home_gallery",
    orderBy: [order],
    include: {
      aps2024_featured_image: {
        select: {
          url: true,
        },
      },
    },
  });
  // Get total count of results
  const totalCount = await prisma.aps2024_home_gallery.count({
    where: {
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

  const homeGalleryFormatted = homeGalleries.map((galerie) => {
    const {
      id_home_gallery,
      aps2024_featured_image,
      id_session,
      id_user,
      id_image,
      featured_image_id,
      ...rest
    } = galerie;
    return {
      id_home_gallery: Number(id_home_gallery),
      featured_image: aps2024_featured_image.url,
      ...rest,
    };
  });

  return { homeGalleries: homeGalleryFormatted, count: totalCount };
};

export const searchOtherGalleriesPublished = async (data) => {
  const {
    pageSize = 10,
    page = 1,
    order = { created_date: "desc" },
    galleryId,
    searchText,
  } = data;

  if (searchText == "") {
    const { homeGalleries, count } = await getOtherGalleriesPublished({
      pageSize,
      page,
      order,
    });
    return { homeGalleries, count };
  }
  const offset = (page - 1) * pageSize;
  const homeGalleries = await prisma.aps2024_home_gallery.findMany({
    take: parseInt(pageSize),
    skip: parseInt(offset),
    orderBy: [order],
    where: {
      NOT: {
        id_home_gallery: galleryId,
      },
      is_publish: true,
      name: {
        contains: searchText,
        mode: "insensitive",
      },
    },
    include: {
      aps2024_featured_image: {
        select: {
          url: true,
        },
      },
    },
  });

  const galleryCount = await prisma.aps2024_home_gallery.count({
    where: {
      NOT: {
        id_home_gallery: galleryId,
      },
      is_publish: true,
      name: {
        contains: searchText,
        mode: "insensitive",
      },
    },
  });

  const galleriesFormatted = homeGalleries.map((galerie) => {
    const {
      id_home_gallery,
      aps2024_featured_image,
      id_session,
      id_user,
      id_image,
      featured_image_id,
      ...rest
    } = galerie;
    return {
      id_home_gallery: Number(id_home_gallery),
      featured_image: aps2024_featured_image.url,
      ...rest,
    };
  });

  return {
    homeGalleries: galleriesFormatted,
    count: galleryCount,
  };
};

export const createGallery = async (galleryData, logData) => {
  const {
    files = [],
    name,
    position = null,
    is_watermarked,
    ...rest
  } = galleryData;

  // Validate gallery has at least two images (including the featured image)
  if (files.length < 2) {
    logger.error({
      ...logData,
      message: "Une tentative de créer une galerie avec moins de deux images.",
    });
    throw new ErrorHandler(
      400,
      "Vous devez fournir au moins deux images pour créer une galerie."
    );
  }

  // Extract featured image (first image in the array)
  const [featuredFile, ...otherFiles] = files;

  // Check if name is already taken
  const existingName = await prisma.aps2024_home_gallery.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive", // Case-insensitive search
      },
    },
  });

  if (existingName) {
    logger.error({
      ...logData,
      message: `Une tentative de créer une nouvelle galerie avec un nom déjà pris: ${existingName.name}.`,
    });
    throw new ErrorHandler(409, "Nom du galerie déjà pris");
  }

  // Upload the featured image separately
  const featuredImageId = await uploadImageGallery([featuredFile], {
    name,
    is_watermarked,
    ...rest,
  });

  // Upload the rest of the gallery images
  const newImageIDs = await uploadImageGallery(otherFiles, {
    name,
    is_watermarked,
    ...rest,
  });
  return await prisma.$transaction(async (prisma) => {
    // Handle position logic (if a gallery is already pinned to the requested position)
    if (position) {
      const existingPinned = await prisma.aps2024_home_gallery.findFirst({
        where: { next_position: position },
      });

      if (existingPinned) {
        await prisma.aps2024_home_gallery.update({
          where: { id_home_gallery: existingPinned.id_home_gallery },
          data: { next_position: null },
        });
      }
    }

    // Create the gallery with featured image and associated images
    const galerie = await prisma.aps2024_home_gallery.create({
      data: {
        ...rest,
        name,
        is_watermarked,
        alias: createAlias(name),
        next_position: position,
        featured_image_id: featuredImageId[0], // Use the first uploaded image as featured
        aps2024_images: {
          connect: newImageIDs.map((id) => ({ id_image: id })), // Connect the remaining images to the gallery
        },
      },
      select: {
        id_home_gallery: true,
        name: true,
        aps2024_featured_image: {
          select: { url: true }, // Select the featured image URL
        },
        aps2024_images: {
          select: { url: true }, // Select gallery images URLs
        },
      },
    });

    return {
      id_home_gallery: Number(galerie.id_home_gallery),
      name: galerie.name,
      featured_image_url: galerie.aps2024_featured_image.url, // Return featured image URL
      images_urls: galerie.aps2024_images.map((img) => img.url), // Return gallery images URLs
    };
  });
};

// Function to change the state (publish/unpublish) of a galerie
export const changeStateGallery = async (userData, logData) => {
  const { galleryId, actionBy } = userData;

  // Check if the galerie to change state exists in the database
  const existingGallery = await prisma.aps2024_home_gallery.findUnique({
    where: { id_home_gallery: galleryId },
    select: {
      name: true,
      is_publish: true,
      position: true,
      next_position: true,
    },
  });

  // If the galerie doesn't exist, throw an error
  if (!existingGallery) {
    logger.error({
      ...logData,
      action: "publication/depublication",
      message: `Une tentative de modification de l'état d'une galerie inexistante.
      Informations de débogage :
      ID du galerie demandé : ${galleryId}`,
    });
    throw new ErrorHandler(400, "Galerie inexistante");
  }

  const updateData = existingGallery.is_publish
    ? {
        publish_down: new Date(),
        unpublish_by: actionBy,
        position: null,
        next_position: null,
      }
    : { publish_date: new Date(), publish_by: actionBy, next_position: null };

  // When publishing, move next_position to pinned_position if it exists and if the gallery is not already in pinned_position
  if (
    !existingGallery.is_publish &&
    !existingGallery.position &&
    existingGallery.next_position
  ) {
    // Check if another galerie is already pinned to this position
    const existingPinned = await prisma.aps2024_home_gallery.findFirst({
      where: {
        position: existingGallery.next_position,
        id_home_gallery: { not: galleryId },
      },
      select: {
        id_home_gallery: true,
      },
    });

    // If another galerie is already pinned to this position, unpin it
    if (existingPinned) {
      await prisma.aps2024_home_gallery.update({
        where: { id_home_gallery: existingPinned.id_home_gallery },
        data: { position: null },
      });
    }

    // Move next_position to pinned_position
    updateData.position = existingGallery.next_position;
  }

  // Update the state of the galerie in the database
  await prisma.aps2024_home_gallery.update({
    where: {
      id_home_gallery: galleryId,
    },
    data: {
      is_publish: !existingGallery.is_publish,
      ...updateData,
    },
  });

  // Return the name and new state of the galerie
  return {
    name: existingGallery.name,
    is_publish: existingGallery.is_publish,
  };
};

// Function to update an existing galerie
export const updateGallery = async (userData, logData) => {
  const {
    galleryId,
    modifiedBy,
    name,
    files = [],
    description,
    credit,
    imagesId, // required IDs of images that should remain
    featuredImage,
    featuredImageId,
    created_by,
    is_watermarked,
    ...rest
  } = userData;

  console.log(userData);
  // Check if the galerie to be updated exists in the database
  const existingGallery = await prisma.aps2024_home_gallery.findUnique({
    where: { id_home_gallery: galleryId },
    select: {
      name: true,
      description: true,
      credit: true,
      featured_image_id: true,
      is_watermarked: true,
      aps2024_images: {
        select: {
          id_image: true,
          name: true,
          description: true,
          url: true,
          credit: true,
        },
      },
    },
  });

  // If the galerie doesn't exist, throw an error
  if (!existingGallery) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'une galerie inexistante.
      Informations de débogage :
      ID du galerie demandé : ${galleryId}`,
    });
    throw new ErrorHandler(400, "Galerie inexistante");
  }

  if (name) {
    // Check if the new name already exists in the database
    const existingName = await prisma.aps2024_home_gallery.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive", // Case-insensitive search
        },
        id_home_gallery: {
          not: galleryId, // Exclude the current gallery
        },
      },
    });
    // If the new name already exists, throw an error
    if (existingName) {
      logger.error({
        ...logData,
        message: `Une tentative de modifer une galerie avec un nom ${existingName.name} déjà pris.
          Informations de débogage :
          Nom demandé : ${name}`,
      });
      throw new ErrorHandler(400, "Nom déjà pris");
    }
  }

  let filteredFiles = files; // Default to all files
  let newImageIDs = [];
  // Determine new featured image
  let newFeaturedImageId = Number(existingGallery.featured_image_id);

  let filteredImagesId = imagesId; // Default to all files

  // If name or description is provided but no new files, update existing images metadata
  if (
    (name !== undefined || description !== undefined || credit !== undefined) &&
    files.length === 0
  ) {
    // Update featured image metadata if it exists
    if (newFeaturedImageId) {
      await prisma.aps2024_images.update({
        where: {
          id_image: newFeaturedImageId,
        },
        data: {
          name: name !== undefined ? name : undefined,
          description: description !== undefined ? description : undefined,
          credit: credit !== undefined ? credit : undefined,
          modified_by: modifiedBy,
          modified_date: new Date(),
        },
      });
    }

    // Update all images in the gallery with the new name/description
    for (const imageId of imagesId) {
      await prisma.aps2024_images.update({
        where: {
          id_image: imageId,
        },
        data: {
          name: name !== undefined ? name : undefined,
          description: description !== undefined ? description : undefined,
          credit: credit !== undefined ? credit : undefined,
          modified_by: modifiedBy,
          modified_date: new Date(),
        },
      });
    }
  }

  if (featuredImageId && featuredImageId !== newFeaturedImageId) {
    // If it's an ID, check if it exists in the current gallery images
    const imageExists = existingGallery.aps2024_images.some(
      (img) => Number(img.id_image) === featuredImageId
    );

    if (!imageExists) {
      throw new ErrorHandler(
        400,
        "L'image sélectionnée comme mise en avant n'existe pas."
      );
    }

    newFeaturedImageId = featuredImageId;
    // Remove featuredImage from imagesId array if it's there
    filteredImagesId = imagesId.filter((id) => id !== featuredImageId);

    // Add the old featured image ID to the list of images to keep ONLY if imagesId is not empty
    if (existingGallery.featured_image_id && imagesId.length > 0) {
      newImageIDs.push(existingGallery.featured_image_id);
    }
  }

  if (featuredImage) {
    // Find and extract the featured image from files
    const normalizeString = (str) => str.trim().normalize("NFC").toLowerCase();

    // Find and extract the featured image from files
    const featuredFileIndex = files.findIndex((file) => {
      const fixedFileName = fixEncoding(file.originalname);
      return normalizeString(fixedFileName) === normalizeString(featuredImage);
    });
    if (featuredFileIndex !== -1) {
      const [featuredFile] = files.splice(featuredFileIndex, 1); // Remove featured file from `files`

      // Upload featured image separately
      const uploadedImage = await uploadImageGallery([featuredFile], {
        name: name === undefined ? existingGallery.name : name,
        description:
          description === undefined ? existingGallery.description : description,
        credit: credit === undefined ? existingGallery.credit : credit,
        is_watermarked:
          is_watermarked === undefined
            ? existingGallery.is_watermarked
            : is_watermarked,
        created_by,
        ...rest,
      });
      newFeaturedImageId = uploadedImage[0]; // Get the new uploaded image ID

      // Add the old featured image ID to the list of images to keep ONLY if imagesId is not empty
      if (existingGallery.featured_image_id && imagesId.length > 0) {
        newImageIDs.push(existingGallery.featured_image_id);
      }
    } else {
      throw new ErrorHandler(
        400,
        "L'image sélectionnée comme mise en avant n'existe pas dans les fichiers téléchargés."
      );
    }

    // Now `files` contains only normal images
    filteredFiles = files;
  }

  // Handle image removals (if any images were removed from the list)
  const existingImageIds = existingGallery.aps2024_images.map((img) =>
    Number(img.id_image)
  );
  const imagesToRemove = existingImageIds.filter(
    (id) => !filteredImagesId.includes(id)
  );

  // Upload new images (if any)
  if (filteredFiles.length > 0) {
    const uploadedIds = await uploadImageGallery(filteredFiles, {
      name: name === undefined ? existingGallery.name : name,
      description:
        description === undefined ? existingGallery.description : description,
      credit: credit === undefined ? existingGallery.credit : credit,
      is_watermarked:
        is_watermarked === undefined
          ? existingGallery.is_watermarked
          : is_watermarked,
      ...rest,
      created_by,
    });
    newImageIDs = [...newImageIDs, ...uploadedIds];
  }

  // Update the galerie in the database
  const updatedGallery = await prisma.aps2024_home_gallery.update({
    where: {
      id_home_gallery: galleryId,
    },
    data: {
      name: name,
      ...(name !== undefined && { alias: createAlias(name) }),
      description: description,
      credit: credit,
      modified_by: modifiedBy,
      modified_date: new Date(),
      featured_image_id: newFeaturedImageId,
      aps2024_images: {
        connect: newImageIDs.map((id) => ({ id_image: id })), // Add new images
        disconnect: imagesToRemove.map((id) => ({ id_image: id })), // Remove deleted images
      },
    },
    select: {
      id_home_gallery: true,
      name: true,
      featured_image_id: true,
      aps2024_featured_image: { select: { url: true } },
      aps2024_images: { select: { id_image: true, url: true } },
    },
  });

  // Return the name of the updated galerie
  return {
    id_home_gallery: Number(updatedGallery.id_home_gallery),
    name: updatedGallery.name,
    featured_image_url: updatedGallery.aps2024_featured_image.url, // Return featured image URL
    images_urls: updatedGallery.aps2024_images.map((img) => img.url), // Return gallery images URLs
  };
};

export const pinGallery = async (galleryData, logData) => {
  const { galleryId, is_pinned, position, modified_by } = galleryData;

  const existingGallery = await prisma.aps2024_home_gallery.findUnique({
    where: { id_home_gallery: galleryId },
    select: {
      id_home_gallery: true,
      name: true,
      is_publish: true,
      position: true,
    },
  });

  // If the galerie doesn't exist, throw an error
  if (!existingGallery) {
    logger.error({
      ...logData,
      message: `Une tentative d'épingler une galerie inexistante.
      Informations de débogage :
      ID du galerie demandé : ${galleryId}`,
    });
    throw new ErrorHandler(400, "Galerie inexistante");
  }

  if (!existingGallery.is_publish) {
    logger.error({
      ...logData,
      message: `Une tentative d'épingler une galerie non publié.
      Informations de débogage :
      ID du galerie demandé : ${galleryId}
      Titre du galerie demandé : ${existingGallery.name}`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas épingler une galerie non publié."
    );
  }

  // if (!is_pinned && !existingGallery.is_pinned) {
  //   throw new ErrorHandler(
  //     400,
  //     "Vous ne pouvez pas dépingler une galerie déja dépingler."
  //   );
  // }

  if (is_pinned) {
    await prisma.$transaction(async (prisma) => {
      // Check if another galerie is already pinned to this position
      const existingPosition = await prisma.aps2024_home_gallery.findFirst({
        where: {
          position,
          NOT: { id_home_gallery: galleryId },
        },
        select: {
          id_home_gallery: true,
        },
      });

      // If a different galerie is already pinned to this position, unpin it
      if (existingPosition) {
        await prisma.aps2024_home_gallery.update({
          where: { id_home_gallery: existingPosition.id_home_gallery },
          data: { position: null, next_position: null },
        });
      }

      // pin the new galerie provided
      await prisma.aps2024_home_gallery.update({
        where: { id_home_gallery: existingGallery.id_home_gallery },
        data: {
          position,
          next_position: null,
          modified_by,
          modified_date: new Date(),
        },
      });
    });
  } else {
    // set galerie is pinned to false
    await prisma.aps2024_home_gallery.update({
      where: { id_home_gallery: galleryId },
      data: {
        modified_by,
        modified_date: new Date(),
        next_position: null,
        position: null,
      },
    });
  }

  //const homePageGalleries = await getHomePageGalleries();

  return {
    name: existingGallery.name,
  };
};

/**
 * Uploads images and returns their IDs
 */
const uploadImageGallery = async (files, imageData) => {
  const imageIds = [];
  for (const file of files) {
    const { path: imagePath, filename, originalname } = file;

    const data = await processNewImages({
      ...imageData,
      originalname,
      imagePath,
      filename,
    });

    imageIds.push(data.id_image);
  }

  return imageIds;
};

/**
 * Processes an image (conversion, storage) and saves it in the database
 */
const processNewImages = async (imageData) => {
  const { name, originalname, imagePath, filename, is_watermarked, ...data } =
    imageData;

  // Process and store the image (converts to WebP, saves in correct location)
  const processedImageUrl = await processAndStoreImages(
    imagePath,
    filename,
    originalname,
    "galerie",
    is_watermarked
  );

  // Save image details in the database
  const image = await prisma.aps2024_images.create({
    data: {
      name,
      url: processedImageUrl,
      source: 0,
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

const fixEncoding = (str) => {
  try {
    return Buffer.from(str, "binary").toString("utf-8");
  } catch (err) {
    return str; // If decoding fails, return the original string
  }
};
