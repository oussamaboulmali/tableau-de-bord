import prisma from "../configs/database.js";
import { processAndStoreImages } from "../helpers/imageHelper.js";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { createAlias } from "../utils/createAlias.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";

const logger = infoLogger("cahiers");

export const getAllCahier = async () => {
  const cahiers = await prisma.aps2024_cahiers_aps.findMany({
    orderBy: [
      {
        created_date: "desc",
      },
    ],
    include: {
      aps2024_images: {
        select: {
          url: true,
          description: true,
        },
      },
    },
  });

  const cahierFormatted = cahiers.map((cahier) => {
    const { id_cahier, aps2024_images, id_session, id_user, ...rest } = cahier;

    return {
      id_cahier: Number(id_cahier),
      url: aps2024_images[0]?.url,
      description: aps2024_images.description,
      ...rest,
    };
  });

  return cahierFormatted;
};

export const getAllCahierWithPaginations = async (data) => {
  const { pageSize, page, order = { created_date: "desc" } } = data;

  const offset = (page - 1) * pageSize;

  const cahiers = await prisma.aps2024_cahiers_aps.findMany({
    take: parseInt(pageSize),
    skip: parseInt(offset),
    orderBy: [order],
    include: {
      aps2024_images: {
        select: {
          url: true,
          description: true,
        },
      },
    },
  });

  const cahiersCount = await prisma.aps2024_cahiers_aps.count();

  const cahierFormatted = cahiers.map((cahier) => {
    const { id_cahier, aps2024_images, id_session, id_user, ...rest } = cahier;
    return {
      id_cahier: Number(id_cahier),
      url: aps2024_images[0]?.url,
      description: aps2024_images[0]?.description,
      ...rest,
    };
  });

  return { cahiers: cahierFormatted, count: cahiersCount };
};

export const searchCahier = async (data) => {
  const { searchText, pageSize, page, order = { created_date: "desc" } } = data;
  // Calculate offset based on page and pageSize
  const offset = pageSize * (page - 1);

  if (searchText == "") {
    const { cahiers, count } = await getAllCahierWithPaginations({
      pageSize,
      page,
      order,
    });
    return { cahiers, count };
  }
  // Search for tag by name with pagination
  const cahiers = await prisma.aps2024_cahiers_aps.findMany({
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
    distinct: "id_cahier",
    orderBy: [order],
    include: {
      aps2024_images: {
        select: {
          url: true,
          description: true,
        },
      },
    },
  });
  // Get total count of results
  const totalCount = await prisma.aps2024_cahiers_aps.count({
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

  const cahierFormatted = cahiers.map((cahier) => {
    const {
      id_cahier,
      aps2024_images,
      id_session,
      id_user,
      id_image,
      ...rest
    } = cahier;
    return {
      id_cahier: Number(id_cahier),
      url: aps2024_images.url,
      description: aps2024_images.description,
      ...rest,
    };
  });

  return { cahiers: cahierFormatted, count: totalCount };
};

export const getOneCahier = async ({ cahierId }) => {
  const cahier = await prisma.aps2024_cahiers_aps.findUnique({
    where: {
      id_cahier: cahierId,
    },
    include: {
      aps2024_images: {
        select: {
          id_image: true,
          url: true,
        },
      },
    },
  });

  if (!cahier) {
    throw new ErrorHandler(404, "cahier inexistant.");
  }

  const { id_cahier, id_image, id_session, aps2024_images, ...rest } = cahier;

  return {
    id_cahier: Number(id_cahier),
    ...rest,
    images: aps2024_images.map((image) => ({
      id_image: Number(image.id_image),
      url: image.url,
      description: image.description,
    })),
  };
};

// Function to change the state (activate/deactivate) of a cahier
export const changeStateCahier = async (userData, logData) => {
  const { cahierId, actionBy } = userData;

  // Check if the cahier to change state exists in the database
  const existingCahier = await prisma.aps2024_cahiers_aps.findUnique({
    where: { id_cahier: cahierId },
    select: {
      name: true,
      is_publish: true,
    },
  });

  // If the cahier doesn't exist, throw an error
  if (!existingCahier) {
    logger.error({
      ...logData,
      action: "publication/depublication",
      message: `Une tentative de modification de l'état d'une cahier inexistante.
      Informations de débogage :
      ID du cahier demandé : ${cahierId}`,
    });
    throw new ErrorHandler(401, "Cahier inexistante");
  }

  const updateData = existingCahier.is_publish
    ? { publish_down: new Date(), unpublish_by: actionBy }
    : { publish_date: new Date(), publish_by: actionBy };

  // Update the state of the cahier in the database
  await prisma.aps2024_cahiers_aps.update({
    where: {
      id_cahier: cahierId,
    },
    data: {
      is_publish: !existingCahier.is_publish,
      ...updateData,
    },
  });

  // Return the name and new state of the cahier
  return {
    name: existingCahier.name,
    is_publish: existingCahier.is_publish,
  };
};

// Function to update an existing cahier
export const updateCahier = async (userData, logData) => {
  const {
    cahierId,
    modifiedBy,
    name,
    files,
    description,
    created_by,
    ...rest
  } = userData;

  // Check if the cahier to be updated exists in the database
  const existingCahier = await prisma.aps2024_cahiers_aps.findUnique({
    where: { id_cahier: cahierId },
    select: {
      id_cahier: true,
      name: true,
      description: true,
      aps2024_images: {
        select: {
          id_image: true,
          name: true,
          description: true,
          url: true,
        },
      },
    },
  });

  // If the cahier doesn't exist, throw an error
  if (!existingCahier) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'une cahier inexistante.
      Informations de débogage :
      ID du cahier demandé : ${cahierId}`,
    });
    throw new ErrorHandler(401, "Cahier inexistante");
  }

  // Check if the new name already exists in the database
  if (name) {
    const existingName = await prisma.aps2024_cahiers_aps.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive", // Case-insensitive search
        },
        id_cahier: {
          not: cahierId, // Exclude the current cahier
        },
      },
    });
    // If the new name already exists, throw an error
    if (existingName) {
      logger.error({
        ...logData,
        message: `Une tentative de modifer une cahier avec un nom ${existingName.name} déjà pris.
          Informations de débogage :
          Nom demandé : ${name}`,
      });
      throw new ErrorHandler(401, "Nom déjà pris");
    }
  }

  let newImageIds = [];

  // Handle image updates
  if (files && files.length > 0) {
    // Upload new images
    newImageIds = await uploadImageCahierInOrder(files, {
      ...rest,
      created_by,
      description:
        description || existingCahier.aps2024_images[0]?.description || "",
      name: name || existingCahier.aps2024_images[0]?.name || "",
    });

    // Always disconnect existing images
    // Get IDs of existing images
    const existingImageIds = existingCahier.aps2024_images.map(
      (img) => img.id_image
    );

    // Disconnect existing images from the cahier
    await prisma.aps2024_cahiers_aps.update({
      where: { id_cahier: cahierId },
      data: {
        aps2024_images: {
          disconnect: existingImageIds.map((id) => ({ id_image: id })),
        },
      },
    });

    await prisma.aps2024_images.deleteMany({
      where: {
        id_image: { in: existingImageIds },
      },
    });
  } else if (name !== undefined || description !== undefined) {
    // If no new files but name/description changed, update the existing images
    for (const image of existingCahier.aps2024_images) {
      await prisma.aps2024_images.update({
        where: {
          id_image: image.id_image,
        },
        data: {
          name: name === undefined ? image.name : name,
          description:
            description === undefined ? image.description : description,
          modified_by: modifiedBy,
          modified_date: new Date(),
        },
      });
    }
  }

  // Prepare the data for cahier update
  const updateData = {
    ...(name !== undefined && { name, alias: createAlias(name) }),
    ...(description !== undefined && { description }),
    modified_by: modifiedBy,
    modified_date: new Date(),
  };

  // If we have new images, connect them to the cahier
  if (newImageIds.length > 0) {
    updateData.aps2024_images = {
      connect: newImageIds.map((id) => ({ id_image: id })),
    };
  }

  // Update the cahier in the database
  const updatedCahier = await prisma.aps2024_cahiers_aps.update({
    where: {
      id_cahier: cahierId,
    },
    data: updateData,
    select: {
      id_cahier: true,
      name: true,
      description: true,
      aps2024_images: {
        select: {
          id_image: true,
          url: true,
        },
      },
    },
  });

  const logMessage = generateCahierLogMessage(existingCahier, updatedCahier);
  // Return the updated cahier information
  return logMessage;
};

export const createMultiCahier = async (cahierData, logData) => {
  const { files = [], name, ...rest } = cahierData;

  // Validate gallery has at least two images (including the featured image)
  if (files.length < 2) {
    logger.error({
      ...logData,
      message:
        "Une tentative de créer un cahier multémedia avec moins de deux images.",
    });
    throw new ErrorHandler(
      400,
      "Vous devez fournir au moins deux images pour créer un cahier multémedia."
    );
  }

  // Check if name is already taken
  const existingName = await prisma.aps2024_cahiers_aps.findFirst({
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
      message: `Une tentative de créer un nouvelle cahier avec un nom ${existingName.name} déjà pris.
      Informations de débogage :
      Nom demandé : ${name}`,
    });
    throw new ErrorHandler(401, "Nom du cahier déjà pris");
  }

  // Upload images sequentially to maintain order
  const newImageIDs = await uploadImageCahierInOrder(files, {
    name,
    ...rest,
  });

  const cahier = await prisma.aps2024_cahiers_aps.create({
    data: {
      ...rest,
      name: name,
      alias: createAlias(name),
      aps2024_images: {
        connect: newImageIDs.map((id) => ({ id_image: id })),
      },
    },
    select: {
      id_cahier: true,
      aps2024_images: {
        select: {
          url: true,
        },
      },
    },
  });

  return {
    id_cahier: Number(cahier.id_cahier),
    url: cahier.aps2024_images.url,
  };
};

/**
 * Uploads images sequentially to maintain the original order
 */
const uploadImageCahierInOrder = async (files, imageData) => {
  const imageIds = [];

  // Process files sequentially instead of in parallel
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
  const { name, originalname, imagePath, filename, ...data } = imageData;

  // Process and store images
  const processedImageUrl = await processAndStoreImages(
    imagePath,
    filename,
    originalname,
    "cahier"
  );

  // Create new image record in the database
  const image = await prisma.aps2024_images.create({
    data: {
      name: name,
      url: processedImageUrl,
      source: 4,
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

function generateCahierLogMessage(oldCahier, updatedCahier) {
  const changes = [];

  // Compare name
  if (oldCahier.name !== updatedCahier.name) {
    changes.push(`name: "${oldCahier.name}" → "${updatedCahier.name}"`);
  }

  // Compare description
  if (oldCahier.description !== updatedCahier.description) {
    changes.push(
      `description: "${oldCahier.description || "non défini"}" → "${
        updatedCahier.description || "non défini"
      }"`
    );
  }

  // Compare images (if images were updated)
  if (oldCahier.aps2024_images.length !== updatedCahier.aps2024_images.length) {
    changes.push(
      `images: ${oldCahier.aps2024_images.length} → ${updatedCahier.aps2024_images.length} images`
    );
  }

  if (changes.length > 0) {
    return `Les informations du cahier "${
      oldCahier.name
    }" ont été modifiées avec succès :
     ${changes.join(", \n ")} `;
  }

  return `Aucun changement détecté pour le cahier "${oldCahier.name}".`;
}
