import prisma from "../configs/database.js";
import { processAndStoreImages } from "../helpers/imageHelper.js";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { createAlias } from "../utils/createAlias.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";

const logger = infoLogger("dossiers");

export const getAllDossier = async () => {
  const dossiers = await prisma.aps2024_dossiers.findMany({
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

  const dossierFormatted = dossiers.map((dossier) => {
    const {
      id_dossier,
      aps2024_images,
      id_session,
      id_user,
      id_image,
      ...rest
    } = dossier;
    return {
      id_dossier: Number(id_dossier),
      url: aps2024_images.url,
      description: aps2024_images.description,
      ...rest,
    };
  });

  return dossierFormatted;
};

export const getOneDossier = async ({ dossierId }) => {
  const dossier = await prisma.aps2024_dossiers.findUnique({
    where: {
      id_dossier: dossierId,
    },
    include: {
      aps2024_images: {
        select: {
          id_image: true,
          url: true,
        },
      },
      aps2024_article_dossier: {
        select: {
          aps2024_articles: {
            select: {
              id_article: true,
              created_date: true,
              title: true,
              publish_date: true,
              views: true,
              aps2024_images: {
                select: {
                  url: true,
                },
              },
              aps2024_categories: {
                select: {
                  name: true,
                },
              },
              aps2024_subCategories: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!dossier) {
    throw new ErrorHandler(404, "dossier inexistant.");
  }

  const {
    id_dossier,
    id_image,
    id_session,
    aps2024_article_dossier,
    aps2024_images,
    ...rest
  } = dossier;

  return {
    id_dossier: Number(id_dossier),
    ...rest,
    image: {
      id_image: Number(aps2024_images.id_image),
      url: aps2024_images.url,
      description: aps2024_images.description,
    },
    articles: aps2024_article_dossier
      .map((item) => {
        const {
          id_article,
          aps2024_categories,
          aps2024_subCategories,
          aps2024_images,
          ...restOfArticle
        } = item.aps2024_articles;
        return {
          id_article: Number(id_article),
          categorie: `${aps2024_categories.name} ${
            aps2024_subCategories ? `/ ${aps2024_subCategories.name}` : ""
          }`,
          url: aps2024_images ? aps2024_images.url : null,
          ...restOfArticle,
        };
      })
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date)),
  };
};

export const createDossier = async (dossierData, logData) => {
  const { file, name, articles = [], ...rest } = dossierData;

  let imageId;
  // Check if name is already taken
  const existingName = await prisma.aps2024_dossiers.findFirst({
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
      message: `Une tentative de créer un nouveau dossier avec un nom ${existingName.name} déjà pris.
      Informations de débogage :
      Nom demandé : ${name}`,
    });
    throw new ErrorHandler(400, "Nom du dossier déjà pris");
  }

  if (file === undefined) {
    logger.error({
      ...logData,
      message: `Une tentative de créer un dossier sans image.`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas créer un dossier sans image"
    );
  }

  if (file != undefined) {
    const { path: imagePath, filename, originalname } = file;
    const data = await uploadImageDossier({
      ...rest,
      name,
      originalname,
      imagePath,
      filename,
    });

    imageId = data.id_image;
  }

  for (const articleId of articles) {
    // Check if the articles  is existed
    const existingArticle = await prisma.aps2024_articles.findUnique({
      where: {
        id_article: articleId,
      },
    });

    if (!existingArticle) {
      logger.error({
        ...logData,
        message: `Une tentative de créer un nouveau dossier avec un article inexistante.
        Informations de débogage :
        ID de l'article demandé : ${articleId}`,
      });
      throw new ErrorHandler(400, "L'un des articles n'a pas été trouvé.");
    }
  }

  const dossier = await prisma.aps2024_dossiers.create({
    data: {
      ...rest,
      name: name,
      alias: createAlias(name),
      id_image: imageId,
      aps2024_article_dossier: {
        createMany: {
          data: articles.map((articleId) => ({
            id_article: articleId,
          })),
        },
      },
    },
    select: {
      id_dossier: true,
      aps2024_images: {
        select: {
          url: true,
        },
      },
    },
  });

  return {
    id_dossier: Number(dossier.id_dossier),
    url: dossier.aps2024_images.url,
  };
};

// Function to change the state (activate/deactivate) of a dossier
export const changeStateDossier = async (userData, logData) => {
  const { dossierId, actionBy } = userData;

  // Check if the dossier to change state exists in the database
  const existingDossier = await prisma.aps2024_dossiers.findUnique({
    where: { id_dossier: dossierId },
    select: {
      name: true,
      is_publish: true,
      _count: {
        select: {
          aps2024_article_dossier: true,
        },
      },
    },
  });

  // If the dossier doesn't exist, throw an error
  if (!existingDossier) {
    logger.error({
      ...logData,
      action: "publication/depublication",
      message: `Une tentative de modification de l'état d'un dossier inexistante.
      Informations de débogage :
      ID du dossier demandé : ${dossierId}`,
    });
    throw new ErrorHandler(400, "Dossier inexistante");
  }

  if (
    !existingDossier.is_publish &&
    existingDossier._count.aps2024_article_dossier === 0
  ) {
    logger.error({
      ...logData,
      action: "publication/depublication",
      message: `Une tentative de publication d'un dossier sans articles.
      Informations de débogage :
      ID du dossier demandé : ${dossierId}
      Titre du dossier demandé : ${existingDossier.name}`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas publier un dossier sans articles."
    );
  }
  const updateData = existingDossier.is_publish
    ? { publish_down: new Date(), unpublish_by: actionBy }
    : { publish_date: new Date(), publish_by: actionBy };

  // Update the state of the dossier in the database
  await prisma.aps2024_dossiers.update({
    where: {
      id_dossier: dossierId,
    },
    data: {
      is_publish: !existingDossier.is_publish,
      ...updateData,
    },
  });

  // Return the name and new state of the dossier
  return { name: existingDossier.name, is_publish: existingDossier.is_publish };
};

// Function to update an existing dossier
export const updateDossier = async (userData, logData) => {
  const {
    dossierId,
    modifiedBy,
    name,
    file,
    description,
    created_by,
    ...rest
  } = userData;
  let imageId;
  // Check if the dossier to be updated exists in the database
  const existingDossier = await prisma.aps2024_dossiers.findUnique({
    where: { id_dossier: dossierId },
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

  // If the dossier doesn't exist, throw an error
  if (!existingDossier) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'un dossier inexistante.
      Informations de débogage :
      ID du dossier demandé : ${dossierId}`,
    });
    throw new ErrorHandler(400, "Dossier inexistante");
  }

  // Check if the new name already exists in the database
  if (name) {
    const existingName = await prisma.aps2024_dossiers.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
        id_dossier: {
          not: dossierId, // Exclude the current dossier
        },
      },
    });
    // If the new name already exists, throw an error
    if (existingName) {
      logger.error({
        ...logData,
        message: `Une tentative de modifer un dossier avec un nom ${existingName.name} déjà pris.
          Informations de débogage :
          Nom demandé : ${name}`,
      });
      throw new ErrorHandler(400, "Nom déjà pris");
    }
  }

  if (file !== undefined) {
    // If a new file is uploaded, upload it and get the new image ID
    const { path: imagePath, filename, originalname } = file;
    const data = await uploadImageDossier({
      ...rest,
      created_by,
      description:
        description === undefined
          ? existingDossier.aps2024_images.description
          : description,
      name: name === undefined ? existingDossier.aps2024_images.name : name,
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
        id_image: existingDossier.id_image,
      },
      data: {
        name: name === undefined ? existingDossier.aps2024_images.name : name,
        description:
          description === undefined
            ? existingDossier.aps2024_images.description
            : description,
        modified_by: modifiedBy,
        modified_date: new Date(),
      },
    });
    // Keep the same image ID
    imageId = existingDossier.id_image;
  } else {
    // No changes to the image
    imageId = existingDossier.id_image;
  }

  // Update the dossier in the database
  const updatedDossier = await prisma.aps2024_dossiers.update({
    where: {
      id_dossier: dossierId,
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

  const logMessage = generateDossierLogMessage(existingDossier, updatedDossier);
  // Return the name of the updated dossier
  return logMessage
};

export const addAritclesToDossier = async (data, logData) => {
  const { dossierId, articles } = data;

  const articlesTitles = [];

  const existingDossier = await prisma.aps2024_dossiers.findUnique({
    where: { id_dossier: dossierId },
  });

  if (!existingDossier) {
    logger.error({
      ...logData,
      message: `Une tentative d'ajout des articles à un dossier inexistant.
      Informations de débogage :
      ID du dossier demandé : ${dossierId}`,
    });
    throw new ErrorHandler(400, "dossier inexistant.");
  }

  for (const articleId of articles) {
    const existingArticle = await prisma.aps2024_articles.findUnique({
      where: {
        id_article: articleId,
      },
      select: {
        title: true,
      },
    });

    if (!existingArticle) {
      logger.error({
        ...logData,
        message: `Une Tentative d'ajout d'un article inexistant à un dossier.
        Informations de débogage :
        ID d'article demandé : ${articleId}`,
      });
      throw new ErrorHandler(400, "Un des articles n'a pas été trouvé.");
    }
    // Check if the dossier already has the article
    const existingDossierArticle =
      await prisma.aps2024_article_dossier.findFirst({
        where: {
          id_dossier: dossierId,
          id_article: articleId,
        },
      });

    if (existingDossierArticle) {
      logger.error({
        ...logData,
        message: `Une Tentative d'ajout à un dossier un article qu'il possède déjà.
        Informations de débogage :
        article demandé : ${articleId}`,
      });
      throw new ErrorHandler(400, "dossier possède déjà l'un des articles.");
    }

    articlesTitles.push(existingArticle.title);
  }

  // If the dossier doesn't have the article, create the relationship
  // Create dossier-article relationships

  await prisma.aps2024_article_dossier.createMany({
    data: articles.map((articleId) => ({
      id_dossier: dossierId,
      id_article: articleId,
    })),
  });

  return { dossierName: existingDossier.name, articlesTitles: articlesTitles };
};

export const removeArticleFromDossier = async (data, logData) => {
  const { dossierId, articleId } = data;

  const existingDossier = await prisma.aps2024_dossiers.findUnique({
    where: { id_dossier: dossierId },
  });

  if (!existingDossier) {
    logger.error({
      ...logData,
      message: `Une tentative de supprimer un article d'un dossier inexistant.
      Informations de débogage :
      ID du dossier demandé : ${dossierId}`,
    });
    throw new ErrorHandler(400, "Dossier inexistant");
  }

  // Check if the dossier  has the article
  const existingDossierArticle = await prisma.aps2024_article_dossier.findFirst(
    {
      where: {
        id_dossier: dossierId,
        id_article: articleId,
      },
      include: {
        aps2024_articles: {
          select: {
            title: true,
          },
        },
      },
    }
  );

  if (!existingDossierArticle) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'un article que le dossier ne possède pas.
      Informations de débogage :
      ID du article demandé : ${articleId}`,
    });
    throw new ErrorHandler(400, "dossier ne possède pas cette article.");
  }

  const countDossierArticles = await prisma.aps2024_article_dossier.count({
    where: {
      id_dossier: dossierId,
    },
  });

  if (countDossierArticles === 1) {
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas supprimer le dernier article du dossier."
    );
  } else {
    await prisma.aps2024_article_dossier.deleteMany({
      where: {
        id_dossier: dossierId,
        id_article: articleId,
      },
    });
  }

  // If the relationship exists, delete it

  return {
    dossierName: existingDossier.name,
    articlesTitle: existingDossierArticle.aps2024_articles.title,
  };
};

export const getOtherArticlesOfDossier = async (data) => {
  const {
    pageSize = 10,
    page = 1,
    order = { created_date: "desc" },
    dossierId,
  } = data;

  const offset = (page - 1) * pageSize;

  // Check if the dossier to be updated exists in the database
  const existingDossier = await prisma.aps2024_dossiers.findUnique({
    where: { id_dossier: dossierId },
  });

  // If the dossier doesn't exist, throw an error
  if (!existingDossier) {
    throw new ErrorHandler(400, "Dossier inexistante");
  }

  // Retrieve all other articles of dossiers from the database
  const otherArticlesDossier = await prisma.aps2024_articles.findMany({
    take: parseInt(pageSize),
    skip: parseInt(offset),
    where: {
      aps2024_article_dossier: {
        every: {
          NOT: {
            id_dossier: dossierId,
          },
        },
      },
    },
    orderBy: {
      ...(order.categorie !== undefined
        ? {
            aps2024_categories: {
              name: order.categorie,
            },
          }
        : order),
    },
    select: {
      id_article: true,
      created_date: true,
      title: true,
      publish_date: true,
      views: true,
      aps2024_images: {
        select: {
          url: true,
        },
      },
      aps2024_categories: {
        select: {
          name: true,
        },
      },
      aps2024_subCategories: {
        select: {
          name: true,
        },
      },
    },
  });

  const otherArticlesDossierCount = await prisma.aps2024_articles.count({
    where: {
      aps2024_article_dossier: {
        none: {
          NOT: {
            id_dossier: dossierId,
          },
        },
      },
    },
  });

  const articlesFormatted = otherArticlesDossier.map((article) => {
    const {
      id_article,
      aps2024_categories,
      aps2024_subCategories,
      aps2024_images,
      ...rest
    } = article;
    return {
      id_article: Number(id_article),
      categorie: aps2024_categories.name,
      subCategorie:
        aps2024_subCategories !== null ? aps2024_subCategories.name : null,
      url: aps2024_images ? aps2024_images.url : null,
      ...rest,
    };
  });

  return {
    articles: articlesFormatted,
    count: otherArticlesDossierCount,
  };
};

export const searchOtherArticlesOfDossier = async (data) => {
  const { pageSize = 10, page = 1, searchText, dossierId } = data;

  // Calculate offset based on page and pageSize
  const offset = pageSize * (page - 1);

  if (searchText == "") {
    const { articles, count } = await getOtherArticlesOfDossier(data);
    return { articles, count };
  }
  // Search for articles by name with pagination
  const otherArticlesDossier = await prisma.aps2024_articles.findMany({
    where: {
      title: {
        contains: searchText,
        mode: "insensitive", // Case-insensitive search
      },
      aps2024_article_dossier: {
        every: {
          NOT: {
            id_dossier: dossierId,
          },
        },
      },
    },
    orderBy: {
      created_date: "desc",
    },
    take: pageSize, // Limit number of results per page
    skip: offset, // Skip results based on page and pageSize
    distinct: "id_article",
    select: {
      id_article: true,
      created_date: true,
      title: true,
      publish_date: true,
      views: true,
      aps2024_images: {
        select: {
          url: true,
        },
      },
      aps2024_categories: {
        select: {
          name: true,
        },
      },
      aps2024_subCategories: {
        select: {
          name: true,
        },
      },
    },
  });
  // Get total count of results
  const otherArticlesDossierCount = await prisma.aps2024_articles.count({
    where: {
      title: {
        contains: searchText,
        mode: "insensitive", // Case-insensitive search
      },
      aps2024_article_dossier: {
        every: {
          NOT: {
            id_dossier: dossierId,
          },
        },
      },
    },
  });
  const articlesFormatted = otherArticlesDossier.map((article) => {
    const {
      id_article,
      aps2024_categories,
      aps2024_subCategories,
      aps2024_images,
      ...rest
    } = article;
    return {
      id_article: Number(id_article),
      categorie: aps2024_categories.name,
      subCategorie:
        aps2024_subCategories !== null ? aps2024_subCategories.name : null,
      url: aps2024_images ? aps2024_images.url : null,
      ...rest,
    };
  });

  return {
    articles: articlesFormatted,
    count: otherArticlesDossierCount,
  };
};

// Function to upload an image
const uploadImageDossier = async (imageData) => {
  const { name, originalname, imagePath, filename, ...data } = imageData;

  // Process and store images
  const processedImageUrl = await processAndStoreImages(
    imagePath,
    filename,
    originalname,
    "dossier"
  );

  // Create new image record in the database
  const image = await prisma.aps2024_images.create({
    data: {
      name: name,
      url: processedImageUrl,
      source: 1,
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

function generateDossierLogMessage(oldDossier, updatedDossier) {
  const changes = [];

  // Compare name
  if (oldDossier.name !== updatedDossier.name) {
    changes.push(`name: "${oldDossier.name}" → "${updatedDossier.name}"`);
  }

  // Compare description
  if (oldDossier.description !== updatedDossier.description) {
    changes.push(`description: "${oldDossier.description || 'non défini'}" → "${updatedDossier.description || 'non défini'}"`);
  }

  if (oldDossier.id_image !== updatedDossier.aps2024_images.id_image) {
    changes.push(`image: changée`);
  }

  if (changes.length > 0) {
    return `Les informations du dossier "${oldDossier.name}" ont été modifiées avec succès :
     ${changes.join(", \n ")} `;
  }

  return `Aucun changement détecté pour le dossier "${oldDossier.name}".`;
}