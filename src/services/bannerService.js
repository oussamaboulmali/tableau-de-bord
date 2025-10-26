import prisma from "../configs/database.js";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";
import { BannerPosition } from "../utils/enum.js";
import { createAlias } from "../utils/createAlias.js";
import { processAndStoreImages } from "../helpers/imageHelper.js";

const logger = infoLogger("bannieres");

export const getAllBanners = async () => {
  const banners = await prisma.aps2024_banners.findMany({
    select: {
      name: true,
      id_banner: true,
      is_publish: true,
      created_by: true,
      created_date: true,
      publish_by: true,
      unpublish_by: true,
      publish_down: true,
      publish_date: true,
      click_url: true,
      is_programmed: true,
      modified_by: true,
      modified_date: true,
      position: true,
      views: true,
      aps2024_banner_categories: {
        select: {
          banner_type: true,
          aps2024_categories: {
            select: {
              id_categorie: true,
              name: true,
            },
          },
        },
      },
      aps2024_images: {
        select: {
          url: true,
          description: true,
        },
      },
    },
    orderBy: {
      created_date: "desc",
    },
  });

  const bannerFormatted = banners.map((banner) => {
    const {
      id_banner,
      aps2024_images,
      position,
      aps2024_banner_categories,
      ...rest
    } = banner;

    return {
      id_banner: Number(id_banner),
      url: aps2024_images.url,
      description: aps2024_images.description,
      position: position
        ? toSentenceCase(BannerPosition.getKeyByValue(banner.position))
        : toSentenceCase(
            BannerPosition.getKeyByValue(
              aps2024_banner_categories[0]?.banner_type
            )
          ),
      categorie: aps2024_banner_categories[0]
        ? aps2024_banner_categories[0].aps2024_categories.name
        : null,
      ...rest,
    };
  });

  return bannerFormatted;
};

export const getOneBanner = async ({ bannerId }) => {
  const banner = await prisma.aps2024_banners.findUnique({
    where: {
      id_banner: bannerId,
    },
    include: {
      aps2024_banner_categories: {
        select: {
          banner_type: true,
          aps2024_categories: {
            select: {
              name: true,
            },
          },
        },
      },
      aps2024_images: {
        select: {
          id_image: true,
          url: true,
          description: true,
        },
      },
    },
  });

  if (!banner) {
    throw new ErrorHandler(404, "banner inexistant.");
  }

  const {
    id_banner,
    id_image,
    id_session,
    aps2024_images,
    aps2024_banner_categories,
    position,
    ...rest
  } = banner;

  return {
    id_banner: Number(id_banner),
    ...rest,
    image: {
      id_image: Number(aps2024_images.id_image),
      url: aps2024_images.url,
      description: aps2024_images.description,
    },
    position: position
      ? BannerPosition.getKeyByValue(banner.position)
      : BannerPosition.getKeyByValue(aps2024_banner_categories[0]?.banner_type),
    categorie: aps2024_banner_categories[0]
      ? {
          id_categorie:
            aps2024_banner_categories[0].aps2024_categories.id_categorie,
          name: aps2024_banner_categories[0].aps2024_categories.name,
        }
      : null,
  };
};

export const createBanner = async (bannerData, logData) => {
  const {
    file,
    name,
    is_publish,
    click_url,
    publish_date,
    publish_down,
    position,
    categorieId,
    banner_type,
    ...rest
  } = bannerData;
  let imageId;

  if (file === undefined) {
    logger.error({
      ...logData,
      message: `Une tentative de créer une bannière sans image.`,
    });
    throw new ErrorHandler(
      401,
      "Vous ne pouvez pas créer une bannière sans image"
    );
  }

  if (position == undefined && categorieId == undefined) {
    logger.error({
      ...logData,
      message: `Une tentative de création d'une bannière sans postion.`,
    });

    throw new ErrorHandler(
      401,
      "Vous ne pouvez pas créer une bannière sans postion"
    );
  }
  if (publish_date !== undefined && new Date(publish_date) < new Date()) {
    logger.error({
      ...logData,
      message: `Une tentative de création d'une bannière avec une date de publication antérieure à aujourd'hui.
      Informations de débogage :
      Date de publication fournie : ${publish_date}`,
    });

    throw new ErrorHandler(
      401,
      "La date de publication ne peut pas être dans le passé."
    );
  }

  if (
    publish_down !== undefined &&
    new Date(publish_down) < new Date(publish_date)
  ) {
    logger.error({
      ...logData,
      message: `Une tentative de création d'une bannière avec une date de fin de publication antérieure ou égale à la date de début.
      Informations de débogage :
      Date de début : ${publish_date}, Date de fin : ${publish_down}`,
    });

    throw new ErrorHandler(
      401,
      "La date de fin de publication doit être postérieure à la date de début."
    );
  }

  if (categorieId) {
    // Check if the category exists in the database
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
        message: `Une tentative de création une nouvelle bannière avec une catégorie inexistante.
      Informations de débogage :
      ID de la catégorie demandé : ${categorieId}`,
      });
      throw new ErrorHandler(400, "Catégorie inexistante");
    }

    if (
      existingCategorie._count.aps2024_subCategories == 0 &&
      banner_type === "MEGA_MENU"
    ) {
      throw new ErrorHandler(
        400,
        "Vous ne pouvez pas attribuer une bannière de menu à cette catégorie car elle n'a pas de sous-catégories"
      );
    }
  }

  if (file != undefined) {
    const { path: imagePath, filename, originalname } = file;
    const data = await uploadImageBanner({
      ...rest,
      name,
      originalname,
      imagePath,
      filename,
    });

    imageId = data.id_image;
  }

  delete rest.description;

  const banner = await prisma.aps2024_banners.create({
    data: {
      name: name,
      click_url: click_url,
      ...(publish_date !== undefined && {
        publish_date: publish_date,
        publish_by: rest.created_by,
        is_programmed: true,
      }),
      ...(publish_down !== undefined && { publish_down: publish_down }),
      ...rest,
      ...(is_publish !== undefined &&
        is_publish !== false && {
          is_publish: is_publish,
          publish_date: new Date(),
          publish_by: rest.created_by,
        }),
      id_image: imageId,
      ...(position !== undefined && { position }),
      ...(categorieId !== undefined && {
        aps2024_banner_categories: {
          create: {
            id_categorie: categorieId,
            banner_type,
          },
        },
      }),
    },
    select: {
      id_banner: true,
      position: true,
      is_publish: true,
      aps2024_images: {
        select: {
          url: true,
        },
      },
    },
  });
  if (banner.is_publish) {
    // Unpublish the others banner of same postition if the banner to be published publish
    await prisma.aps2024_banners.updateMany({
      where: {
        AND: [
          {
            NOT: {
              id_banner: banner.id_banner,
            },
          },
          {
            position: banner.position,
          },
        ],
      },
      data: {
        is_publish: false,
        is_programmed: false,
      },
    });
  }
  return {
    id_banner: Number(banner.id_banner),
    url: banner.aps2024_images.url,
  };
};

// Function to change the state (activate/deactivate) of a banner
export const changeStateBanner = async (userData, logData) => {
  const { bannerId, actionBy } = userData;

  // Check if the banner to change state exists in the database
  const existingBanner = await prisma.aps2024_banners.findUnique({
    where: { id_banner: bannerId },
    select: {
      name: true,
      is_publish: true,
      position: true,
      aps2024_banner_categories: {
        select: {
          id_categorie: true,
          banner_type: true,
        },
      },
    },
  });

  // If the banner doesn't exist, throw an error
  if (!existingBanner) {
    logger.error({
      ...logData,
      action: "publication/depublication",
      message: `Une tentative de modification de l'état d'une bannière inexistante.
      Informations de débogage :
      ID du banner demandé : ${bannerId}`,
    });
    throw new ErrorHandler(401, "Banner inexistante");
  }

  const updateData = existingBanner.is_publish
    ? { publish_down: new Date(), unpublish_by: actionBy }
    : { publish_date: new Date(), publish_by: actionBy };

  await prisma.$transaction(async (prisma) => {
    // Update the state of the banner in the database
    await prisma.aps2024_banners.update({
      where: {
        id_banner: bannerId,
      },
      data: {
        is_programmed: false,
        is_publish: !existingBanner.is_publish,
        ...updateData,
      },
    });

    // Only handle conflicts when publishing (not unpublishing)
    if (!existingBanner.is_publish) {
      // Case 1: Banner has a position (homepage placement)
      if (existingBanner.position !== null) {
        // Unpublish other banners with the same position (no categories)
        await prisma.aps2024_banners.updateMany({
          where: {
            AND: [
              {
                NOT: {
                  id_banner: bannerId,
                },
              },
              {
                position: existingBanner.position,
              },
              {
                aps2024_banner_categories: {
                  none: {}, // No categories - position-based banners
                },
              },
            ],
          },
          data: {
            is_publish: false,
            is_programmed: false,
          },
        });
      }

      // Case 2: Banner has categories (category-based placement)
      if (existingBanner.aps2024_banner_categories.length > 0) {
        // For each category this banner belongs to, unpublish conflicting banners
        for (const category of existingBanner.aps2024_banner_categories) {
          await prisma.aps2024_banners.updateMany({
            where: {
              AND: [
                {
                  NOT: {
                    id_banner: bannerId,
                  },
                },
                {
                  aps2024_banner_categories: {
                    some: {
                      id_categorie: category.id_categorie,
                      banner_type: category.banner_type,
                    },
                  },
                },
              ],
            },
            data: {
              is_publish: false,
              is_programmed: false,
            },
          });
        }
      }
    }
  });

  // Return the name and new state of the banner
  return {
    name: existingBanner.name,
    is_publish: existingBanner.is_publish,
  };
};
// Function to update an existing banner
export const updateBanner = async (userData, logData) => {
  const {
    bannerId,
    modifiedBy,
    name,
    file,
    click_url,
    description,
    publish_down,
    publish_date: userPublishUp,
    position,
    categorieId,
    banner_type,
    created_by,
    ...rest
  } = userData;

  let imageId;
  let publish_date;

  // Check if the banner to be updated exists in the database
  const existingBanner = await prisma.aps2024_banners.findUnique({
    where: { id_banner: bannerId },
    select: {
      name: true,
      click_url: true,
      publish_date: true,
      publish_down: true,
      id_image: true,
      is_publish: true,
      position: true,
      aps2024_banner_categories: {
        select: {
          id_categorie: true,
          banner_type: true,
        },
      },
      aps2024_images: {
        select: {
          id_image: true,
          name: true,
          description: true,
        },
      },
    },
  });

  if (!existingBanner) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'une bannière inexistante.
      Informations de débogage :
      ID du banner demandé : ${bannerId}`,
    });
    throw new ErrorHandler(401, "Bannière inexistante");
  }

  // Validate position and category logic
  if (position !== undefined && categorieId !== undefined) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'une bannière avec position et catégorie en même temps.`,
    });
    throw new ErrorHandler(
      401,
      "Vous ne pouvez pas définir à la fois une position et une catégorie"
    );
  }

  // If categorieId is provided, validate it exists
  if (categorieId !== undefined) {
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

    if (!existingCategorie) {
      logger.error({
        ...logData,
        message: `Une tentative de modification d'une bannière avec une catégorie inexistante.
        Informations de débogage :
        ID de la catégorie demandé : ${categorieId}`,
      });
      throw new ErrorHandler(400, "Catégorie inexistante");
    }

    if (
      existingCategorie._count.aps2024_subCategories == 0 &&
      banner_type === "MEGA_MENU"
    ) {
      throw new ErrorHandler(
        400,
        "Vous ne pouvez pas attribuer une bannière de menu à cette catégorie car elle n'a pas de sous-catégories"
      );
    }
  }

  const isUserProvidingPublishDate = userPublishUp !== undefined;
  publish_date = isUserProvidingPublishDate
    ? userPublishUp
    : existingBanner.publish_date == null
    ? undefined
    : existingBanner.publish_date;

  if (publish_date === undefined && publish_down !== undefined) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'une bannière avec une date de fin de publication fournie sans date de début de publication.
          Informations de débogage :
          Date de fin de publication fournie : ${publish_down}`,
    });
    throw new ErrorHandler(
      401,
      "Une date de début de publication est requise si une date de fin de publication est fournie."
    );
  }

  if (isUserProvidingPublishDate && new Date(publish_date) < new Date()) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'une bannière avec une date de publication antérieure à aujourd'hui.
      Informations de débogage :
      Date de publication fournie : ${publish_date}`,
    });
    throw new ErrorHandler(
      401,
      "La date de publication ne peut pas être dans le passé."
    );
  }

  if (
    publish_down !== undefined &&
    new Date(publish_down) < new Date(publish_date)
  ) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'une bannière avec une date de fin de publication antérieure ou égale à la date de début.
      Informations de débogage :
      Date de début : ${publish_date}, Date de fin : ${publish_down}`,
    });
    throw new ErrorHandler(
      401,
      "La date de fin de publication doit être postérieure à la date de début."
    );
  }

  // Handle image upload or update
  if (file !== undefined) {
    const { path: imagePath, filename, originalname } = file;
    const data = await uploadImageBanner({
      ...rest,
      created_by,
      description:
        description === undefined
          ? existingBanner.aps2024_images.description
          : description,
      name: name === undefined ? existingBanner.aps2024_images.name : name,
      originalname,
      imagePath,
      filename,
    });
    imageId = data.id_image;
  } else if (name !== undefined || description !== undefined) {
    await prisma.aps2024_images.update({
      where: {
        id_image: existingBanner.id_image,
      },
      data: {
        name: name === undefined ? existingBanner.aps2024_images.name : name,
        description:
          description === undefined
            ? existingBanner.aps2024_images.description
            : description,
        modified_by: modifiedBy,
        modified_date: new Date(),
      },
    });
    imageId = existingBanner.id_image;
  } else {
    imageId = existingBanner.id_image;
  }

  // Use transaction to handle position/category changes
  const updatedBanner = await prisma.$transaction(async (prisma) => {
    // Update the banner record
    const banner = await prisma.aps2024_banners.update({
      where: {
        id_banner: bannerId,
      },
      data: {
        name: name,
        click_url: click_url,
        modified_by: modifiedBy,
        modified_date: new Date(),
        ...(publish_date !== undefined && {
          publish_date: publish_date,
          publish_by: modifiedBy,
          is_programmed: true,
        }),
        ...(publish_down !== undefined && {
          publish_down: publish_down,
          is_programmed: true,
        }),
        id_image: imageId,
        ...(position !== undefined && { position }),
      },
      select: {
        name: true,
        click_url: true,
        publish_date: true,
        publish_down: true,
        is_publish: true,
        position: true,
        aps2024_banner_categories: {
          select: {
            id_categorie: true,
            banner_type: true,
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

    // Handle category changes if provided
    if (
      categorieId !== undefined ||
      banner_type !== undefined ||
      position !== undefined
    ) {
      // If switching to position, remove all categories
      if (position !== undefined) {
        await prisma.aps2024_banner_categories.deleteMany({
          where: {
            id_banner: bannerId,
          },
        });
      }
      // If setting category, remove existing categories and add new one
      else if (categorieId !== undefined || banner_type !== undefined) {
        // Remove existing categories
        await prisma.aps2024_banner_categories.deleteMany({
          where: {
            id_banner: bannerId,
          },
        });

        // Add new category if provided
        if (categorieId !== undefined) {
          await prisma.aps2024_banner_categories.create({
            data: {
              id_banner: bannerId,
              id_categorie: categorieId,
              banner_type: banner_type,
            },
          });
        }

        await prisma.aps2024_banners.update({
          where: {
            id_banner: bannerId,
          },
          data: {
            position: null,
          },
        });
      }
    }

    // Handle position conflicts if banner is published and position changed
    if (banner.is_publish && position !== undefined) {
      // Handle position conflicts if banner is published and position changed
      const positionChanged = existingBanner.position !== position;

      if (positionChanged) {
        // Unpublish other banners with the same position (no categories)
        await prisma.aps2024_banners.updateMany({
          where: {
            AND: [
              {
                NOT: {
                  id_banner: bannerId,
                },
              },
              {
                position: position,
              },
              {
                aps2024_banner_categories: {
                  none: {},
                },
              },
            ],
          },
          data: {
            is_publish: false,
            is_programmed: false,
          },
        });
      }
    }

    // Handle category conflicts if banner is published and category changed
    if (banner.is_publish && categorieId !== undefined) {
      const currentCategory = existingBanner.aps2024_banner_categories[0];
      const categoryChanged =
        !currentCategory ||
        currentCategory.id_categorie !== categorieId ||
        currentCategory.banner_type !== banner_type;

      if (categoryChanged) {
        // Unpublish other banners with same category and banner_type
        await prisma.aps2024_banners.updateMany({
          where: {
            AND: [
              {
                NOT: {
                  id_banner: bannerId,
                },
              },
              {
                aps2024_banner_categories: {
                  some: {
                    id_categorie: categorieId,
                    banner_type: banner_type,
                  },
                },
              },
            ],
          },
          data: {
            is_publish: false,
            is_programmed: false,
          },
        });
      }
    }

    return banner;
  });

  // Generate and return the log message
  const logMessage = generateBannerLogMessage(existingBanner, updatedBanner);
  return logMessage;
};

// Function to upload an image
const uploadImageBanner = async (imageData) => {
  const { name, originalname, imagePath, filename, ...data } = imageData;

  // Process and store images
  const processedImageUrl = await processAndStoreImages(
    imagePath,
    filename,
    originalname,
    "banner"
  );

  // Create new image record in the database
  const image = await prisma.aps2024_images.create({
    data: {
      name: name,
      url: processedImageUrl,
      source: 2,
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

function toSentenceCase(str) {
  const lower = str.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function generateBannerLogMessage(oldBanner, updatedBanner) {
  const changes = [];

  if (oldBanner.name !== updatedBanner.name) {
    changes.push(`nom: "${oldBanner.name}" → "${updatedBanner.name}"`);
  }

  if (oldBanner.click_url !== updatedBanner.click_url) {
    changes.push(
      `URL de clic: "${oldBanner.click_url || "non défini"}" → "${
        updatedBanner.click_url || "non défini"
      }"`
    );
  }

  // Compare publish dates
  const oldPublishDate = oldBanner.publish_date
    ? new Date(oldBanner.publish_date).toLocaleDateString()
    : "non défini";
  const newPublishDate = updatedBanner.publish_date
    ? new Date(updatedBanner.publish_date).toLocaleDateString()
    : "non défini";
  if (oldPublishDate !== newPublishDate) {
    changes.push(
      `date de publication: "${oldPublishDate}" → "${newPublishDate}"`
    );
  }

  // Compare publish down dates
  const oldPublishDown = oldBanner.publish_down
    ? new Date(oldBanner.publish_down).toLocaleDateString()
    : "non défini";
  const newPublishDown = updatedBanner.publish_down
    ? new Date(updatedBanner.publish_down).toLocaleDateString()
    : "non défini";
  if (oldPublishDown !== newPublishDown) {
    changes.push(
      `date de fin de publication: "${oldPublishDown}" → "${newPublishDown}"`
    );
  }

  // Compare positions
  if (oldBanner.position !== updatedBanner.position) {
    changes.push(
      `position: "${oldBanner.position || "non défini"}" → "${
        updatedBanner.position || "non défini"
      }"`
    );
  }

  // Compare categories
  const oldCategory = oldBanner.aps2024_banner_categories[0];
  const newCategory = updatedBanner.aps2024_banner_categories[0];

  const oldCategoryInfo = oldCategory
    ? `catégorie: ${oldCategory.id_categorie}, type: ${oldCategory.banner_type}`
    : "aucune catégorie";
  const newCategoryInfo = newCategory
    ? `catégorie: ${newCategory.id_categorie}, type: ${newCategory.banner_type}`
    : "aucune catégorie";

  if (oldCategoryInfo !== newCategoryInfo) {
    changes.push(`catégorie: "${oldCategoryInfo}" → "${newCategoryInfo}"`);
  }

  // Check if image changed
  if (
    oldBanner.aps2024_images.id_image !== updatedBanner.aps2024_images.id_image
  ) {
    changes.push(`image: changée`);
  }

  if (changes.length > 0) {
    return `Les informations de la bannière "${
      oldBanner.name
    }" ont été modifiées avec succès :
     ${changes.join(", \n ")} `;
  }

  return `Aucun changement détecté pour la bannière "${oldBanner.name}".`;
}
