// Import necessary modules and dependencies
import prisma from "../configs/database.js";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";

// Logger instance for logging category-related actions
const logger = infoLogger("catégories");

// Function to retrieve all categories from the database
export const getAllCategories = async () => {
  // Retrieve all categories from the database
  const categories = await prisma.aps2024_categories.findMany({
    orderBy: [
      {
        id_categorie: "asc",
      },
    ],
    include: {
      _count: {
        select: {
          aps2024_subCategories: true,
        },
      },
    },
  });

  // Format retrieved categories to remove unnecessary fields
  const categoriesFormatted = categories.map((categorie) => {
    const { id_session, _count, ...rest } = categorie;
    return {
      ...rest,
      hasChild: _count.aps2024_subCategories > 0 ? true : false,
    };
  });

  return categoriesFormatted;
};

// Function to retrieve all categories from the database
export const getAllCategoriesWithSubCategorie = async () => {
  // Retrieve all categories from the database
  const categories = await prisma.aps2024_categories.findMany({
    orderBy: [
      {
        id_categorie: "asc",
      },
    ],
    select: {
      id_categorie: true,
      name: true,
      aps2024_subCategories: {
        select: {
          id_subCategorie: true,
          name: true,
        },
        orderBy: {
          id_subCategorie: "asc",
        },
      },
    },
  });

  // Format retrieved categories to remove unnecessary fields
  const categoriesFormatted = categories.map((categorie) => {
    return {
      id_categorie: categorie.id_categorie,
      name: categorie.name,
      subCategorie: categorie.aps2024_subCategories.map((item) => {
        return {
          id_subCategorie: item.id_subCategorie,
          name: item.name,
        };
      }),
    };
  });

  const defaultCategorie = await getDefaultCategorie();

  return {
    categoriesFormatted,
    ...defaultCategorie,
  };
};

export const getDefaultCategorie = async () => {
  const defaultCategorie = await prisma.aps2024_defaultCategorie.findFirst({
    where: {
      id_defaultCategorie: 1,
    },
  });

  return {
    defaultCategorieId: defaultCategorie.id_categorie,
    defaultSubCategorieId: defaultCategorie.id_subCategorie,
  };
};

export const setDefaultCategory = async (userData, logData) => {
  const { categorieId, subCategorieId, modifiedBy } = userData;

  // Check if the category to be updated exists in the database
  const existingCategorie = await prisma.aps2024_categories.findUnique({
    where: { id_categorie: categorieId },
    select: {
      name: true,
      _count: {
        select: {
          aps2024_subCategories: true,
        },
      },
    },
  });

  // If the category doesn't exist, throw an error
  if (!existingCategorie) {
    logger.error({
      ...logData,
      message: `Une tentative de modification de la catégorie par défaut avec une catégorie inexistante.
      Informations de débogage :
      ID de la catégorie demandé : ${categorieId}`,
    });
    throw new ErrorHandler(400, "Catégorie inexistante");
  }

  // Check if the category has subcategories
  const hasSubCategories = existingCategorie._count.aps2024_subCategories > 0;

  // If the category has subcategories, subCategoryId is required
  if (hasSubCategories && !subCategorieId) {
    logger.error({
      ...logData,
      message: `Une tentative de modification de la catégorie par défaut sans sous-catégorie.
        Informations de débogage :
        ID de la catégorie demandé : ${categorieId}`,
    });
    throw new ErrorHandler(
      400,
      "Cette catégorie comporte des sous-catégories, veuillez fournir une sous-catégorie par défaut."
    );
  }

  let existingSubCategorie = null;
  // Validate subcategory if provided
  if (subCategorieId && hasSubCategories) {
    existingSubCategorie = await prisma.aps2024_subCategories.findUnique({
      where: { id_subCategorie: subCategorieId },
      select: {
        id_categorie: true,
        id_subCategorie: true,
        name: true,
      },
    });

    if (
      !existingSubCategorie ||
      existingSubCategorie.id_categorie !== categorieId
    ) {
      logger.error({
        ...logData,
        message: `Une tentative de modification de la catégorie par défaut avec une sous-catégorie inexistante.
            Informations de débogage :
            ID de la sous-catégorie demandé : ${subCategorieId}`,
      });
      throw new ErrorHandler(400, "Sous-catégorie inexistante");
    }
  }

  // Update the category in the database
  await prisma.aps2024_defaultCategorie.update({
    where: {
      id_defaultCategorie: 1,
    },
    data: {
      id_categorie: categorieId,
      id_subCategorie: hasSubCategories ? subCategorieId : null,
      modified_by: modifiedBy,
      modified_date: new Date(),
    },
  });

  // Return the new category sub category
  return {
    categorieName: existingCategorie.name,
    subCategorieName: existingSubCategorie?.name,
  };
};

// Function to create a new category
export const createCategorie = async (categorieData, logData) => {
  const { name } = categorieData;

  // Check if the provided name or alias already exists in the database
  const existingName = await prisma.aps2024_categories.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive", // Case-insensitive search
      },
    },
  });

  // If the name or alias already exists, throw an error
  if (existingName) {
    logger.error({
      ...logData,
      message: `Une tentative de créer une nouvelle catégorie avec un nom ${existingName.name} déjà pris.
      Informations de débogage :
      Nom demandé : ${name}`,
    });
    throw new ErrorHandler(400, "Nom déjà pris");
  }

  // Create the new category in the database
  const categorie = await prisma.aps2024_categories.create({
    data: {
      alias: createAlias(name),
      ...categorieData,
    },
    select: {
      id_categorie: true,
      name: true,
      alias: true,
    },
  });

  return categorie;
};

// Function to update an existing category
export const updateCategorie = async (userData, logData) => {
  const { categorieId, modifiedBy, name, alias } = userData;

  // Check if the category to be updated exists in the database
  const existingCategorie = await prisma.aps2024_categories.findUnique({
    where: { id_categorie: categorieId },
  });

  // If the category doesn't exist, throw an error
  if (!existingCategorie) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'une catégorie inexistante.
      Informations de débogage :
      ID de la catégorie demandé : ${categorieId}`,
    });
    throw new ErrorHandler(400, "Catégorie inexistante");
  }

  if (name || alias) {
    // Check if the new name or alias already exists in the database
    const existingName = await prisma.aps2024_categories.findFirst({
      where: {
        id_categorie: {
          not: categorieId,
        },
        OR: [
          {
            name: {
              equals: name,
              mode: "insensitive", // Case-insensitive search
            },
          },
          {
            alias: {
              equals: alias,
              mode: "insensitive", // Case-insensitive search
            },
          },
        ],
      },
    });

    // If the new name or alias already exists, throw an error
    if (existingName) {
      logger.error({
        ...logData,
        message: `Une tentative de modifer une catégorie avec un nom ${
          existingName.name
        }${
          existingName.alias.includes(alias)
            ? ` et un alias ${existingName.alias}`
            : ""
        } déjà pris.
      Informations de débogage :
      Nom demandé : ${name}
      Alias demandé : ${alias}`,
      });
      throw new ErrorHandler(
        400,
        `${
          existingName.alias.includes(alias)
            ? "Nom ou alias déjà pris"
            : "Nom déjà pris"
        }`
      );
    }
  }
  // Update the category in the database
  await prisma.aps2024_categories.update({
    where: {
      id_categorie: categorieId,
    },
    data: {
      name: name,
      alias: alias ? createAlias(alias) : createAlias(name),
      modified_by: modifiedBy,
      modified_date: new Date(),
    },
  });

  // Return the name of the updated category
  return existingCategorie.name;
};

// Function to change the state (activate/deactivate) of a category
export const changeStateCategorie = async (userData, logData) => {
  const { categorieId, changeBy } = userData;

  // Check if the category to change state exists in the database
  const existingCategorie = await prisma.aps2024_categories.findUnique({
    where: { id_categorie: categorieId },
  });

  // If the category doesn't exist, throw an error
  if (!existingCategorie) {
    logger.error({
      ...logData,
      action: "activation/desactivation",
      message: `Une tentative de modification de l'état d'une catégorie inexistante.
      Informations de débogage :
      ID de la catégorie demandé : ${categorieId}`,
    });
    throw new ErrorHandler(400, "Catégorie inexistante");
  }

  const { defaultCategorieId } = await getDefaultCategorie();

  if (
    existingCategorie.state &&
    existingCategorie.id_categorie === defaultCategorieId
  ) {
    logger.error({
      ...logData,
      action: "activation/desactivation",
      message: `Une tentative de modification de l'état d'une catégorie par defaut.
      Informations de débogage :
      ID de la catégorie demandé : ${categorieId}`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas désactiver une catégorie par défaut dans la page d'accueil du site."
    );
  }

  // Update the state of the category in the database
  await prisma.aps2024_categories.update({
    where: {
      id_categorie: categorieId,
    },
    data: {
      state: !existingCategorie.state,
      change_state_by: changeBy,
      change_state_date: new Date(),
      aps2024_subCategories: {
        updateMany: {
          where: {
            id_categorie: categorieId,
          },
          data: {
            state: !existingCategorie.state,
            change_state_by: changeBy,
            change_state_date: new Date(),
          },
        },
      },
    },
  });

  // Return the name and new state of the category
  return { name: existingCategorie.name, state: existingCategorie.state };
};

// Function to create a new category
export const addSubCategorieToCategorie = async (categorieData, logData) => {
  const {
    names = [],
    categorieId,
    subCategories = [],
    ...rest
  } = categorieData;

  // Check if the category to be updated exists in the database
  const existingCategorie = await prisma.aps2024_categories.findUnique({
    where: { id_categorie: categorieId },
  });

  // If the category doesn't exist, throw an error
  if (!existingCategorie) {
    logger.error({
      ...logData,
      message: `Une tentative d'ajout des sous-catégories à une catégorie cinexistante.
      Informations de débogage :
      ID de la catégorie demandé : ${categorieId}`,
    });
    throw new ErrorHandler(400, "Catégorie inexistante");
  }

  const { defaultSubCategorieId } = await getDefaultCategorie();

  for (const subCategorieId of subCategories) {
    const existingSubCategorie = await prisma.aps2024_subCategories.findUnique({
      where: { id_subCategorie: subCategorieId },
    });

    // If the category doesn't exist, throw an error
    if (!existingSubCategorie) {
      logger.error({
        ...logData,
        message: `Une tentative d'ajout d'une sous-catégories inexistante.
        Informations de débogage :
        ID de la sosu-catégorie demandé : ${subCategorieId}`,
      });
      throw new ErrorHandler(400, "Sous-Catégorie inexistante");
    }

    if (categorieId == existingSubCategorie.id_categorie) {
      logger.error({
        ...logData,
        message: `Une tentative d'ajout d'une sous-catégorie deja existant à la catégorie ${existingCategorie.name}.
        Informations de débogage :
        sous-categorie demandé : ${existingSubCategorie.name}`,
      });
      throw new ErrorHandler(
        400,
        "La catégorie possède déjà l'un des sous-catégorie."
      );
    }

    if (existingSubCategorie.id_subCategorie === defaultSubCategorieId) {
      logger.error({
        ...logData,
        message: `Une tentative d'ajout d'une souscatégorie par defaut dans autre catégorie.
        Informations de débogage :
        ID de la catégorie demandé : ${subCategorieId}`,
      });
      throw new ErrorHandler(
        400,
        "Vous ne pouvez pas ajouter la sous-catégorie dans cette catégorie car cette sous-catégorie est par défaut dans la page d'accueil du site."
      );
    }
  }

  for (const name of names) {
    // Check if the provided name or alias already exists in the database
    const existingName = await prisma.aps2024_subCategories.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive", // Case-insensitive search
        },
      },
    });

    // If the name or alias already exists, throw an error
    if (existingName) {
      logger.error({
        ...logData,
        message: `Une tentative de créer une nouvelle sous-catégorie avec un nom ${existingName.name} déjà pris.
      Informations de débogage :
      Nom demandé : ${name}`,
      });
      throw new ErrorHandler(400, "Nom déjà pris");
    }
  }

  const newSubCategoriesIds =
    await prisma.aps2024_subCategories.createManyAndReturn({
      select: {
        id_subCategorie: true,
      },
      data: names.map((name) => ({
        name: name,
        alias: createAlias(name),
        ...rest,
      })),
    });

  subCategories.map((id) => newSubCategoriesIds.push({ id_subCategorie: id }));

  // Create the new category in the database
  const newSubCategories = await prisma.aps2024_categories.update({
    where: {
      id_categorie: categorieId,
    },
    data: {
      aps2024_subCategories: {
        connect: newSubCategoriesIds,
      },
    },
    select: {
      aps2024_subCategories: {
        select: {
          id_subCategorie: true,
          name: true,
          alias: true,
          created_date: true,
          created_by: true,
        },
      },
    },
  });

  return {
    subCategories: newSubCategories.aps2024_subCategories,
    categorieName: existingCategorie.name,
  };
};

export const updateSubCategorie = async (userData, logData) => {
  const { subCategorieId, modifiedBy, name, alias } = userData;

  // Check if the category to be updated exists in the database
  const existingSubCategorie = await prisma.aps2024_subCategories.findUnique({
    where: { id_subCategorie: subCategorieId },
  });

  // If the category doesn't exist, throw an error
  if (!existingSubCategorie) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'une sous-catégorie inexistante.
      Informations de débogage :
      ID de la sous-catégorie demandé : ${subCategorieId}`,
    });
    throw new ErrorHandler(400, "Sous-Catégorie inexistante");
  }

  // Check if the new name or alias already exists in the database
  if (name || alias) {
    const existingName = await prisma.aps2024_subCategories.findFirst({
      where: {
        id_subCategorie: {
          not: subCategorieId, // Exclude the current subCategorie
        },
        OR: [
          {
            name: {
              equals: name,
              mode: "insensitive", // Case-insensitive search
            },
          },
          {
            alias: {
              equals: alias,
              mode: "insensitive", // Case-insensitive search
            },
          },
        ],
      },
    });

    // If the new name or alias already exists, throw an error
    if (existingName) {
      logger.error({
        ...logData,
        message: `Une tentative de modifer une sous-catégorie avec un nom ${
          existingName.name
        }${
          existingName.alias.includes(alias)
            ? ` et un alias ${existingName.alias}`
            : ""
        } déjà pris.
      Informations de débogage :
      Nom demandé : ${name}
      Alias demandé : ${alias}`,
      });
      throw new ErrorHandler(
        400,
        `${
          existingName.alias.includes(alias)
            ? "Nom ou alias déjà pris"
            : "Nom déjà pris"
        }`
      );
    }
  }
  // Update the category in the database
  await prisma.aps2024_subCategories.update({
    where: {
      id_subCategorie: subCategorieId,
    },
    data: {
      name: name,
      alias: alias ? createAlias(alias) : createAlias(name),
      modified_by: modifiedBy,
      modified_date: new Date(),
    },
  });

  // Return the name of the updated category
  return existingSubCategorie.name;
};

// Function to change the state (activate/deactivate) of a category
export const changeStateSubCategorie = async (userData, logData) => {
  const { subCategorieId, changeBy } = userData;

  // Check if the category to change state exists in the database
  const existingSubCategorie = await prisma.aps2024_subCategories.findUnique({
    where: { id_subCategorie: subCategorieId },
  });

  // If the category doesn't exist, throw an error
  if (!existingSubCategorie) {
    logger.error({
      ...logData,
      action: "activation/desactivation",
      message: `Une tentative de modification de l'état d'une sous-catégorie inexistante.
      Informations de débogage :
      ID de la sous-catégorie demandé : ${subCategorieId}`,
    });
    throw new ErrorHandler(400, "Sous-Catégorie inexistante");
  }

  const { defaultSubCategorieId } = await getDefaultCategorie();

  if (
    existingSubCategorie.state &&
    existingSubCategorie.id_subCategorie === defaultSubCategorieId
  ) {
    logger.error({
      ...logData,
      action: "activation/desactivation",
      message: `Une tentative de modification de l'état d'une souscatégorie par defaut.
      Informations de débogage :
      ID de la catégorie demandé : ${subCategorieId}`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas désactiver une sous-catégorie par défaut dans la page d'accueil du site."
    );
  }

  // Update the state of the category in the database
  await prisma.aps2024_subCategories.update({
    where: {
      id_subCategorie: subCategorieId,
    },
    data: {
      state: !existingSubCategorie.state,
      change_state_by: changeBy,
      change_state_date: new Date(),
    },
  });

  // Return the name and new state of the category
  return { name: existingSubCategorie.name, state: existingSubCategorie.state };
};

export const getOtherSubCategories = async ({ categorieId }) => {
  // Retrieve all subCategories from the database
  const subCategories = await prisma.aps2024_subCategories.findMany({
    where: {
      id_categorie: { not: categorieId },
    },
    orderBy: [
      {
        created_date: "desc",
      },
    ],
  });
  // Format retrieved subCategories to remove unnecessary fields
  const subCategoriesFormatted = subCategories.map((categorie) => {
    const { id_session, ...rest } = categorie;
    return rest;
  });

  return subCategoriesFormatted;
};

export const getSubCategoriesOFcategorie = async ({ categorieId }) => {
  // Retrieve all subCategories from the database
  const subCategories = await prisma.aps2024_subCategories.findMany({
    where: {
      id_categorie: categorieId,
    },
    orderBy: [
      {
        created_date: "asc",
      },
    ],
  });

  // Format retrieved subCategories to remove unnecessary fields
  const subCategoriesFormatted = subCategories.map((categorie) => {
    const { id_session, ...rest } = categorie;
    return rest;
  });

  return subCategoriesFormatted;
};

export const createAlias = (input) => {
  // Normalize to decompose diacritics (optional for Latin-based languages)
  let result = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Convert to lowercase (only affects Latin-based letters)
  result = result.toLowerCase();

  // Replace all punctuation/whitespace with hyphens
  result = result.replace(/[\s\p{P}\p{S}]+/gu, "-");

  // Remove leading/trailing hyphens
  result = result.replace(/^-+|-+$/g, "");

  return result;
};

// async function archiveOldArticles() {
//   const now = new Date();

//   const fourMonthsAgo = new Date(now);

//   // Subtract 4 months
//   fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 10);

//   // Normalize to 00:00:00 UTC to avoid timezone issues
//   const fourMonthsAgoUTC = new Date(
//     Date.UTC(
//       fourMonthsAgo.getFullYear(),
//       fourMonthsAgo.getMonth(),
//       fourMonthsAgo.getDate()
//     )
//   );

//   console.log("Four months ago (UTC):", fourMonthsAgoUTC.toISOString());
//   // Fetch articles older than one year
//   const oldArticles = await prisma.aps2024_articles.findMany({
//     where: {
//       publish_date: {
//         lt: fourMonthsAgoUTC,
//       },
//     },
//     select: {
//       id_article: true,
//       id_gallery: true,
//       id_image: true,
//       alias: true,
//       fulltext: true,
//       introtext: true,
//       supTitle: true,
//       title: true,
//       click_count: true,
//       publish_date: true,
//       aps2024_categories: {
//         select: {
//           name: true,
//         },
//       },
//       aps2024_subCategories: {
//         select: {
//           name: true,
//         },
//       },
//       aps2024_article_tag: {
//         select: {
//           aps2024_tag: {
//             select: {
//               name: true,
//             },
//           },
//         },
//       },
//     },
//   });

//   for (const article of oldArticles) {
//     const tags = article.aps2024_article_tag.map(
//       (tagRel) => tagRel.aps2024_tag.name
//     );

//     await prisma.aps2024_archive.create({
//       data: {
//         id_article: article.id_article,
//         id_gallery: article.id_gallery,
//         id_image: article.id_image,
//         alias: article.alias,
//         title: article.title,
//         introtext: article.introtext,
//         fulltext: article.fulltext || "",
//         supTitle: article.supTitle,
//         publish_date: article.publish_date,
//         click_count: article.click_count,
//         tags: tags,
//         categorie: article.aps2024_categories.name,
//         subCategorie: article.aps2024_subCategories?.name || null,
//       },
//     });

//     // Optionally delete the original article
//     await prisma.aps2024_articles.delete({
//       where: {
//         id_article: article.id_article,
//       },
//     });
//   }

//   console.log(`${oldArticles.length} articles archived.`);
// }
