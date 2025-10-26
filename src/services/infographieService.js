import prisma from "../configs/database.js";
import { processAndStoreImages } from "../helpers/imageHelper.js";

import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { createAlias } from "../utils/createAlias.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";

const logger = infoLogger("infographies");

export const getAllInfographie = async () => {
  const infographies = await prisma.aps2024_infographies.findMany({
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

  const infographieFormatted = infographies.map((infographie) => {
    const {
      id_infographie,
      aps2024_images,
      id_session,
      id_user,
      id_image,
      ...rest
    } = infographie;
    return {
      id_infographie: Number(id_infographie),
      url: aps2024_images.url,
      description: aps2024_images.description,
      ...rest,
    };
  });

  return infographieFormatted;
};

export const getAllInfographieWithPaginations = async (data) => {
  const { pageSize, page, order = { created_date: "desc" } } = data;

  const offset = (page - 1) * pageSize;

  const infographies = await prisma.aps2024_infographies.findMany({
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

  const infographiesCount = await prisma.aps2024_infographies.count();

  const infographieFormatted = infographies.map((infographie) => {
    const {
      id_infographie,
      aps2024_images,
      id_session,
      id_user,
      id_image,
      ...rest
    } = infographie;
    return {
      id_infographie: Number(id_infographie),
      url: aps2024_images.url,
      description: aps2024_images.description,
      ...rest,
    };
  });

  return { infographies: infographieFormatted, count: infographiesCount };
};

export const searchInfographie = async (data) => {
  const { searchText, pageSize, page, order = { created_date: "desc" } } = data;
  // Calculate offset based on page and pageSize
  const offset = pageSize * (page - 1);

  if (searchText == "") {
    const { infographies, count } = await getAllInfographieWithPaginations({
      pageSize,
      page,
      order,
    });
    return { infographies, count };
  }
  // Search for tag by name with pagination
  const infographies = await prisma.aps2024_infographies.findMany({
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
    distinct: "id_infographie",
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
  const totalCount = await prisma.aps2024_infographies.count({
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

  const infographieFormatted = infographies.map((infographie) => {
    const {
      id_infographie,
      aps2024_images,
      id_session,
      id_user,
      id_image,
      ...rest
    } = infographie;
    return {
      id_infographie: Number(id_infographie),
      url: aps2024_images.url,
      description: aps2024_images.description,
      ...rest,
    };
  });

  return { infographies: infographieFormatted, count: totalCount };
};

export const getOneInfographie = async ({ infographieId }) => {
  const infographie = await prisma.aps2024_infographies.findUnique({
    where: {
      id_infographie: infographieId,
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

  if (!infographie) {
    throw new ErrorHandler(404, "infographie inexistant.");
  }

  const { id_infographie, id_image, id_session, aps2024_images, ...rest } =
    infographie;

  return {
    id_infographie: Number(id_infographie),
    ...rest,
    image: {
      id_image: Number(aps2024_images.id_image),
      url: aps2024_images.url,
      description: aps2024_images.description,
    },
  };
};

export const createInfographie = async (dossierData, logData) => {
  const { file, name, ...rest } = dossierData;

  let imageId;
  // Check if name is already taken
  const existingName = await prisma.aps2024_infographies.findFirst({
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
      message: `Une tentative de créer une nouvelle infographie avec un nom ${existingName.name} déjà pris.
      Informations de débogage :
      Nom demandé : ${name}`,
    });
    throw new ErrorHandler(401, "Nom du infographie déjà pris");
  }

  if (file === undefined) {
    logger.error({
      ...logData,
      message: `Une tentative de créer une infographie sans image.`,
    });
    throw new ErrorHandler(
      401,
      "Vous ne pouvez pas créer une infographie sans image"
    );
  }

  if (file != undefined) {
    const { path: imagePath, filename, originalname } = file;
    const data = await uploadImageInfographie({
      ...rest,
      name,
      originalname,
      imagePath,
      filename,
    });

    imageId = data.id_image;
  }

  const infographie = await prisma.aps2024_infographies.create({
    data: {
      ...rest,
      name: name,
      id_image: imageId,
      alias: createAlias(name),
    },
    select: {
      id_infographie: true,
      aps2024_images: {
        select: {
          url: true,
        },
      },
    },
  });

  return {
    id_infographie: Number(infographie.id_infographie),
    url: infographie.aps2024_images.url,
  };
};

// Function to change the state (activate/deactivate) of a infographie
export const changeStateInfographie = async (userData, logData) => {
  const { infographieId, actionBy } = userData;

  // Check if the infographie to change state exists in the database
  const existingInfographie = await prisma.aps2024_infographies.findUnique({
    where: { id_infographie: infographieId },
    select: {
      name: true,
      is_publish: true,
    },
  });

  // If the infographie doesn't exist, throw an error
  if (!existingInfographie) {
    logger.error({
      ...logData,
      action: "publication/depublication",
      message: `Une tentative de modification de l'état d'une infographie inexistante.
      Informations de débogage :
      ID du infographie demandé : ${infographieId}`,
    });
    throw new ErrorHandler(401, "Infographie inexistante");
  }

  const updateData = existingInfographie.is_publish
    ? { publish_down: new Date(), unpublish_by: actionBy }
    : { publish_date: new Date(), publish_by: actionBy };

  // Update the state of the infographie in the database
  await prisma.aps2024_infographies.update({
    where: {
      id_infographie: infographieId,
    },
    data: {
      is_publish: !existingInfographie.is_publish,
      ...updateData,
    },
  });

  // Return the name and new state of the infographie
  return {
    name: existingInfographie.name,
    is_publish: existingInfographie.is_publish,
  };
};

// Function to update an existing infographie
export const updateInfographie = async (userData, logData) => {
  const {
    infographieId,
    modifiedBy,
    name,
    file,
    description,
    created_by,
    ...rest
  } = userData;
  let imageId;

  // Check if the infographie to be updated exists in the database
  const existingInfographie = await prisma.aps2024_infographies.findUnique({
    where: { id_infographie: infographieId },
    select: {
      id_image: true,
      name: true,
      description: true,
      aps2024_images: {
        select: {
          id_image: true,
          name: true,
          description: true,
        },
      },
    },
  });

  // If the infographie doesn't exist, throw an error
  if (!existingInfographie) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'une infographie inexistante.
      Informations de débogage :
      ID du infographie demandé : ${infographieId}`,
    });
    throw new ErrorHandler(401, "Infographie inexistante");
  }

  // Check if the new name already exists in the database
  if (name) {
    const existingName = await prisma.aps2024_infographies.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive", // Case-insensitive search
        },
        id_infographie: {
          not: infographieId, // Exclude the current infographie
        },
      },
    });

    // If the new name already exists, throw an error
    if (existingName) {
      logger.error({
        ...logData,
        message: `Une tentative de modifer une infographie avec un nom ${existingName.name} déjà pris.
          Informations de débogage :
          Nom demandé : ${name}`,
      });
      throw new ErrorHandler(401, "Nom déjà pris");
    }
  }

  if (file !== undefined) {
    // If a new file is uploaded, upload it and get the new image ID
    const { path: imagePath, filename, originalname } = file;
    const data = await uploadImageInfographie({
      ...rest,
      created_by,
      description:
        description === undefined
          ? existingInfographie.aps2024_images.description
          : description,
      name: name === undefined ? existingInfographie.aps2024_images.name : name,
      originalname,
      imagePath,
      filename,
    });

    imageId = data.id_image;
  } else if (name !== undefined || description !== undefined) {
    // If no new file is uploaded but name or description is changed,
    // update the existing image's name or description
    await prisma.aps2024_images.update({
      where: {
        id_image: existingInfographie.id_image,
      },
      data: {
        name:
          name === undefined ? existingInfographie.aps2024_images.name : name,
        description:
          description === undefined
            ? existingInfographie.aps2024_images.description
            : description,
        modified_by: modifiedBy,
        modified_date: new Date(),
      },
    });
    // Keep the same image ID
    imageId = existingInfographie.id_image;
  } else {
    // No changes to the image
    imageId = existingInfographie.id_image;
  }

  // Update the infographie in the database
  const updatedInfographie = await prisma.aps2024_infographies.update({
    where: {
      id_infographie: infographieId,
    },
    data: {
      name: name,
      ...(name !== undefined && { alias: createAlias(name) }),
      description: description,
      modified_by: modifiedBy,
      modified_date: new Date(),
      id_image: imageId,
    },
    select: {
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

  // Return the name of the updated infographie
  const logMessage = generateInfographieLogMessage(existingInfographie, updatedInfographie);
  return logMessage
};

// Function to upload an image
const uploadImageInfographie = async (imageData) => {
  const { name, originalname, imagePath, filename, ...data } = imageData;

  // Process and store images
  const processedImageUrl = await processAndStoreImages(
    imagePath,
    filename,
    originalname,
    "infographie"
  );

  // Create new image record in the database
  const image = await prisma.aps2024_images.create({
    data: {
      name: name,
      url: processedImageUrl,
      source: 3,
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

function generateInfographieLogMessage(oldInfographie, updatedInfographie) {
  const changes = [];

  if (oldInfographie.name !== updatedInfographie.name) {
    changes.push(`name: "${oldInfographie.name}" → "${updatedInfographie.name}"`);
  }

  if (oldInfographie.description !== updatedInfographie.description) {
    changes.push(`description: "${oldInfographie.description || 'non défini'}" → "${updatedInfographie.description || 'non défini'}"`);
  }

  if (oldInfographie.id_image !== updatedInfographie.aps2024_images.id_image) {
    changes.push(`image: changée`);
  }

  if (changes.length > 0) {
    return `Les informations de l'infographie "${oldInfographie.name}" ont été modifiées avec succès :
     ${changes.join(", \n ")} `;
  }

  return `Aucun changement détecté pour l'infographie "${oldInfographie.name}".`;
}