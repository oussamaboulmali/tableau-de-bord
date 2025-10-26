import prisma from "../configs/database.js";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { createAlias, updateAlias } from "../utils/createAlias.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";
import { getDefaultCategorie } from "./categorieService.js";

// Initialize logger
const logger = infoLogger("articles");

export const getLanguages = async () => {
  const languages = await prisma.aps2024_languages.findMany({
    orderBy: {
      id_lang: "asc",
    },
  });

  const filteredLanguages = languages.filter(
    (lang) => lang.code !== process.env.PROJECT_LANG
  );

  return filteredLanguages;
};

export const getAllArticles = async (data) => {
  const {
    pageSize = 10,
    page = 1,
    order = { created_date: "desc" },
    filter = {},
  } = data;

  const filtreCondition = transformObject(filter);
  const offset = (page - 1) * pageSize;
  const articles = await prisma.aps2024_articles.findMany({
    take: parseInt(pageSize),
    skip: parseInt(offset),
    orderBy: {
      ...(order.categorie !== undefined
        ? {
            aps2024_categories: {
              name: order.categorie,
            },
          }
        : order),
    },
    where: filtreCondition,
    select: {
      id_article: true,
      created_date: true,
      title: true,
      is_publish: true,
      is_validated: true,
      validate_date: true,
      publish_date: true,
      publish_down: true,
      publish_by: true,
      created_by: true,
      supTitle: true,
      is_trash: true,
      is_pinned: true,
      is_programmed: true,
      is_locked: true,
      views: true,
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
      aps2024_images: {
        select: {
          id_image: true,
          url: true,
        },
      },
    },
  });

  const articlesCount = await prisma.aps2024_articles.count({
    where: filtreCondition,
  });

  const articlesFormatted = articles.map((article) => {
    const {
      id_article,
      aps2024_categories,
      aps2024_images,
      aps2024_subCategories,
      ...rest
    } = article;
    return {
      id_article: Number(id_article),
      categorie: aps2024_categories.name,
      subCategorie:
        aps2024_subCategories !== null ? aps2024_subCategories.name : null,
      image:
        aps2024_images !== null
          ? {
              id_image: Number(aps2024_images.id_image),
              url: aps2024_images.url,
            }
          : null,
      ...rest,
    };
  });

  return {
    articles: articlesFormatted,
    count: articlesCount,
  };
};

export const getOtherArticlesPublished = async (data) => {
  const {
    pageSize = 10,
    page = 1,
    order = { created_date: "desc" },
    blockId,
    categorieId = null,
    subCategorieId = null,
    articleId,
  } = data;
  const offset = (page - 1) * pageSize;
  const articles = await prisma.aps2024_articles.findMany({
    take: parseInt(pageSize),
    skip: parseInt(offset),
    orderBy: {
      ...(order.categorie !== undefined
        ? {
            aps2024_categories: {
              name: order.categorie,
            },
          }
        : order),
    },
    where: {
      NOT: {
        id_article: articleId,
      },
      is_publish: true,
      ...(categorieId != null && { id_categorie: categorieId }),
      ...(subCategorieId != null && { id_subCategorie: subCategorieId }),
    },
    select: {
      id_article: true,
      created_date: true,
      title: true,
      is_publish: true,
      is_validated: true,
      validate_date: true,
      publish_date: true,
      publish_down: true,
      created_by: true,
      supTitle: true,
      is_trash: true,
      is_pinned: true,
      id_categorie: true,
      id_subCategorie: true,
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
      aps2024_images: {
        select: {
          id_image: true,
          url: true,
        },
      },
    },
  });

  const articlesCount = await prisma.aps2024_articles.count({
    where: {
      NOT: {
        id_article: articleId,
      },
      is_publish: true,
      ...(categorieId != null && { id_categorie: categorieId }),
      ...(subCategorieId != null && { id_subCategorie: subCategorieId }),
    },
  });

  const articlesFormatted = articles.map((article) => {
    const {
      id_article,
      aps2024_categories,
      aps2024_images,
      aps2024_subCategories,
      ...rest
    } = article;
    return {
      id_article: Number(id_article),
      categorie: aps2024_categories.name,
      subCategorie:
        aps2024_subCategories !== null ? aps2024_subCategories.name : null,
      image:
        aps2024_images !== null
          ? {
              id_image: Number(aps2024_images.id_image),
              url: aps2024_images.url,
            }
          : null,
      ...rest,
    };
  });

  return {
    articles: articlesFormatted,
    count: articlesCount,
  };
};

export const getBlocksWithPosition = async (data) => {
  const blocks = await prisma.aps2024_blocks.findMany({
    orderBy: {
      id_block: "asc",
    },
    select: {
      id_block: true,
      name: true,
    },
  });

  const blocksFormatted = blocks.map((article) => {
    const { ...rest } = article;
    return {
      ...rest,
    };
  });

  return {
    blocks: blocksFormatted,
  };
};

export const fetchArticlesForBlock = async (data) => {
  let { categorieId = null, subCategorieId = null } = data;
  const defaultCategorie = await getDefaultCategorie();
  categorieId =
    categorieId !== null ? categorieId : defaultCategorie.defaultCategorieId;

  const existingCategorie = await prisma.aps2024_categories.findUnique({
    where: { id_categorie: categorieId },
    select: {
      id_categorie: true,
      name: true,
      _count: {
        select: {
          aps2024_subCategories: true,
        },
      },
    },
  });

  if (!existingCategorie) throw new ErrorHandler(404, "No Categorie found");

  if (
    existingCategorie._count.aps2024_subCategories == 0 &&
    subCategorieId == null
  ) {
    subCategorieId = undefined;
  } else {
    subCategorieId =
      subCategorieId !== null
        ? subCategorieId
        : defaultCategorie.defaultSubCategorieId;
  }

  const existingSubCategorie = await prisma.aps2024_subCategories.findFirst({
    where: { id_subCategorie: subCategorieId, id_categorie: categorieId },
    select: {
      id_subCategorie: true,
      name: true,
    },
  });

  if (subCategorieId && !existingSubCategorie)
    throw new ErrorHandler(404, "No SubCategorie found");

  // Fetch all blocks along with their associated pinned and unpinned articles
  const blocks = await prisma.aps2024_blocks.findMany({
    orderBy: { id_block: "asc" },
    select: {
      id_block: true,
      name: true,
      max_positions: true,
      aps2024_block_position: {
        orderBy: { position: "asc" },
        where: {
          aps2024_articles: { is_publish: true },
        },
        select: {
          position: true,
          id_article: true,
          aps2024_articles: {
            select: {
              id_article: true,
              title: true,
              introtext: true,
              publish_date: true,
              id_categorie: true,
              id_subCategorie: true,
              is_pinned: true,
              aps2024_categories: { select: { name: true } },
              aps2024_subCategories: { select: { name: true } },
              aps2024_images: { select: { url: true } },
            },
          },
        },
      },
      aps2024_block_position_actualites: {
        orderBy: { position: "asc" },
        where: {
          id_categorie: categorieId,
          id_subCategorie: subCategorieId,
          aps2024_articles: { is_publish: true },
        },
        select: {
          position: true,
          id_article: true,
          aps2024_articles: {
            select: {
              id_article: true,
              title: true,
              introtext: true,
              publish_date: true,
              is_pinned: true,
              aps2024_images: { select: { url: true } },
              id_categorie: true,
              id_subCategorie: true,
              aps2024_categories: { select: { name: true } },
              aps2024_subCategories: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  // Process each block individually
  const formattedBlocks = await Promise.all(
    blocks.map(async (block) => {
      const { id_block, name, max_positions } = block;

      let pinnedArticles = [];
      let unpinnedArticles = [];

      if (id_block === 3) {
        // For Block 3 (Actualités), get pinned articles from aps2024_block_position_actualites
        pinnedArticles = block.aps2024_block_position_actualites
          .filter((pos) => pos.id_article)
          .map((pos) => ({
            ...pos.aps2024_articles,
            position: pos.position,
          }))
          .sort((a, b) => a.position - b.position);

        const pinnedArticleIds = pinnedArticles.map(
          (article) => article.id_article
        );
        // Identify empty positions in Block 3
        const pinnedPositions = pinnedArticles.map((pos) => pos.position);
        const allPositions = Array.from(
          { length: max_positions },
          (_, i) => i + 1
        );
        const emptyPositions = allPositions.filter(
          (pos) => !pinnedPositions.includes(pos)
        );

        if (emptyPositions.length !== 0) {
          // Fetch unpinned articles for Block 3, filtered by category and subcategory
          unpinnedArticles = await prisma.aps2024_articles.findMany({
            where: {
              id_categorie: categorieId,
              id_subCategorie: subCategorieId,
              id_block: id_block,
              is_pinned: false,
              is_publish: true,
              id_article: { notIn: pinnedArticleIds },
            },
            orderBy: { publish_date: "desc" },
            take: emptyPositions.length,
            select: {
              id_article: true,
              title: true,
              introtext: true,
              publish_date: true,
              id_subCategorie: true,
              is_pinned: true,
              aps2024_images: { select: { url: true } },
            },
          });

          unpinnedArticles = unpinnedArticles.map((article, index) => ({
            ...article,
            position: emptyPositions[index],
          }));
        }
      } else {
        // For other blocks, keep the original logic
        pinnedArticles = block.aps2024_block_position
          .filter((pos) => pos.id_article)
          .map((pos) => ({
            ...pos.aps2024_articles,
            position: pos.position,
          }))
          .sort((a, b) => a.position - b.position);
        const pinnedArticleIds = pinnedArticles.map(
          (article) => article.id_article
        );
        const pinnedPositions = pinnedArticles.map((pos) => pos.position);
        const allPositions = Array.from(
          { length: max_positions },
          (_, i) => i + 1
        );
        const emptyPositions = allPositions.filter(
          (pos) => !pinnedPositions.includes(pos)
        );

        if (emptyPositions.length !== 0) {
          unpinnedArticles = await prisma.aps2024_articles.findMany({
            where: {
              id_block: id_block,
              is_pinned: false,
              is_publish: true,
              id_article: { notIn: pinnedArticleIds },
            },
            orderBy: { publish_date: "desc" },
            take: emptyPositions.length,
            select: {
              id_article: true,
              title: true,
              introtext: true,
              publish_date: true,
              id_subCategorie: true,
              is_pinned: true,
              aps2024_images: { select: { url: true } },
            },
          });

          unpinnedArticles = unpinnedArticles.map((article, index) => ({
            ...article,
            position: emptyPositions[index],
          }));
        }
      }

      // Merge pinned and unpinned articles
      const allArticles = [...pinnedArticles, ...unpinnedArticles].sort(
        (a, b) => a.position - b.position
      );

      // Format the articles for the response
      return {
        id_block,
        name,
        articles: allArticles.map((article) => ({
          id_article: Number(article.id_article),
          title: article.title,
          introtext: article.introtext,
          publish_date: article.publish_date,
          id_subCategorie: article.id_subCategorie,
          url: article.aps2024_images?.url || null,
          is_pinned: article.is_pinned,
        })),
      };
    })
  );

  return formattedBlocks;
};

export const getOneArticle = async ({ articleId }) => {
  const article = await prisma.aps2024_articles.findUnique({
    where: {
      id_article: articleId,
    },
    include: {
      aps2024_blocks: {
        select: {
          name: true,
        },
      },
      aps2024_categories: {
        select: {
          name: true,
        },
      },
      aps2024_subCategories: {
        select: {
          id_subCategorie: true,
          name: true,
        },
      },
      aps2024_images: {
        select: {
          id_image: true,
          name: true,
          description: true,
          url: true,
        },
      },
      aps2024_gallery: {
        select: {
          id_gallery: true,
          name: true,
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
      },
      aps2024_article_tag: {
        select: {
          aps2024_tag: {
            select: {
              id_tag: true,
              name: true,
            },
          },
        },
      },
      aps2024_article_translated: {
        select: {
          id_lien: true,
          url: true,
          aps2024_languages: {
            select: {
              id_lang: true,
              label: true,
              code: true,
            },
          },
        },
      },
      aps2024_article_dossier: {
        select: {
          aps2024_dossiers: {
            select: {
              id_dossier: true,
              name: true,
              aps2024_images: {
                select: {
                  url: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!article) {
    throw new ErrorHandler(404, "No Article found");
  }
  let position = null;
  if (article.id_block == 3) {
    position = await prisma.aps2024_block_position_actualites.findFirst({
      where: {
        id_article: articleId,
      },
      select: {
        position: true,
      },
    });
  } else {
    position = await prisma.aps2024_block_position.findFirst({
      where: {
        id_article: articleId,
      },
      select: {
        position: true,
      },
    });
  }

  const {
    id_session,
    id_article,
    aps2024_categories,
    aps2024_images,
    aps2024_article_tag,
    id_gallery,
    id_image,
    id_blocPosition,
    aps2024_article_translated,
    aps2024_article_dossier,
    aps2024_gallery,
    aps2024_subCategories,
    aps2024_blocks,
    ...rest
  } = article;

  return {
    id_article: Number(id_article),
    categorie: aps2024_categories.name,
    subCategorie:
      aps2024_subCategories !== null ? aps2024_subCategories.name : null,
    blockname: aps2024_blocks !== null ? aps2024_blocks.name : null,
    position: position?.position,
    image:
      aps2024_images !== null
        ? {
            id_image: Number(aps2024_images.id_image),
            url: aps2024_images.url,
            name: aps2024_images.name,
            description: aps2024_images.description,
          }
        : null,
    gallery:
      aps2024_gallery !== null
        ? {
            id_gallery: Number(aps2024_gallery.id_gallery),
            name: aps2024_gallery.name,
            url: aps2024_gallery.aps2024_gallery_image[0].aps2024_images.url,
          }
        : null,
    tags: aps2024_article_tag.map((item) => ({
      id_tag: Number(item.aps2024_tag.id_tag),
      name: item.aps2024_tag.name,
    })),
    translated_article: aps2024_article_translated.map((item) => ({
      id_lien: Number(item.id_lien),
      url: item.url,
      lang: item.aps2024_languages,
    })),
    dossier: aps2024_article_dossier.map((item) => ({
      id_dossier: Number(item.aps2024_dossiers.id_dossier),
      url: item.aps2024_dossiers.aps2024_images.url,
      name: item.aps2024_dossiers.name,
    })),
    ...rest,
  };
};

export const getArticleByUrl = async ({ url }) => {
  const idPart = extractIDFromURL(url); // updated extractor

  if (!idPart) {
    throw new ErrorHandler(
      404,
      "L'alias ne contient pas un identifiant valide."
    );
  }

  const article = await prisma.aps2024_articles.findFirst({
    where: {
      OR: [{ alias: idPart }, { alias: { startsWith: `${idPart}-` } }],
    },
    select: {
      id_article: true,
      title: true,
    },
  });

  if (!article) {
    throw new ErrorHandler(404, "Aucun article ne correspond à l'URL fournie.");
  }

  return {
    articleId: Number(article.id_article),
    title: article.title,
  };
};

export const searchArticles = async (data) => {
  const {
    pageSize = 10,
    page = 1,
    order = { created_date: "desc" },
    filter = {},
    searchText,
  } = data;

  const filtreCondition = transformObject(filter);
  // Calculate offset based on page and pageSize
  const offset = pageSize * (page - 1);

  if (searchText == "") {
    const { articles, count } = await getAllArticles({ pageSize, page });
    return { articles, count };
  }

  // Search for articles by name with pagination
  const articles = await prisma.aps2024_articles.findMany({
    where: {
      ...filtreCondition,
      title: {
        contains: searchText,
        mode: "insensitive",
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
    take: pageSize, // Limit number of results per page
    skip: offset, // Skip results based on page and pageSize
    distinct: "id_article",
    select: {
      id_article: true,
      created_date: true,
      title: true,
      is_publish: true,
      is_validated: true,
      validate_date: true,
      publish_date: true,
      publish_down: true,
      created_by: true,
      supTitle: true,
      is_trash: true,
      is_pinned: true,
      is_programmed: true,
      is_locked: true,
      publish_by: true,
      views: true,
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
      aps2024_images: {
        select: {
          id_image: true,
          url: true,
        },
      },
    },
  });
  // Get total count of results
  const totalCount = await prisma.aps2024_articles.count({
    where: {
      title: {
        contains: searchText,
        mode: "insensitive",
      },
    },
  });
  const articlesFormatted = articles.map((article) => {
    const {
      id_article,
      aps2024_categories,
      aps2024_images,
      aps2024_subCategories,
      ...rest
    } = article;
    return {
      id_article: Number(id_article),
      categorie: aps2024_categories.name,
      subCategorie:
        aps2024_subCategories !== null ? aps2024_subCategories.name : null,
      image:
        aps2024_images !== null
          ? {
              id_image: Number(aps2024_images.id_image),
              url: aps2024_images.url,
            }
          : null,
      ...rest,
    };
  });
  return { articles: articlesFormatted, count: totalCount };
};

export const searchOtherPublishedArticles = async (data) => {
  const {
    pageSize = 10,
    page = 1,
    order = { created_date: "desc" },
    categorieId = null,
    subCategorieId = null,
    searchText,
    articleId,
  } = data;

  // Calculate offset based on page and pageSize
  const offset = pageSize * (page - 1);

  if (searchText == "") {
    const { articles, count } = await getOtherArticlesPublished(data);
    return { articles, count };
  }

  // Search for articles by name with pagination
  const articles = await prisma.aps2024_articles.findMany({
    where: {
      NOT: {
        id_article: articleId,
      },
      is_publish: true,
      ...(categorieId != null && { id_categorie: categorieId }),
      ...(subCategorieId != null && { id_subCategorie: subCategorieId }),
      title: {
        contains: searchText,
        mode: "insensitive",
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
    take: pageSize, // Limit number of results per page
    skip: offset, // Skip results based on page and pageSize
    distinct: "id_article",
    select: {
      id_article: true,
      created_date: true,
      title: true,
      is_publish: true,
      is_validated: true,
      validate_date: true,
      publish_date: true,
      created_by: true,
      supTitle: true,
      id_categorie: true,
      id_subCategorie: true,
      views: true,
      publish_by: true,
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
      aps2024_images: {
        select: {
          id_image: true,
          url: true,
        },
      },
    },
  });
  // Get total count of results
  const totalCount = await prisma.aps2024_articles.count({
    where: {
      NOT: {
        id_article: articleId,
      },
      is_publish: true,
      ...(categorieId != null && { id_categorie: categorieId }),
      ...(subCategorieId != null && { id_subCategorie: subCategorieId }),
      title: {
        contains: searchText,
        mode: "insensitive",
      },
    },
  });
  const articlesFormatted = articles.map((article) => {
    const {
      id_article,
      aps2024_categories,
      aps2024_images,
      aps2024_subCategories,
      ...rest
    } = article;
    return {
      id_article: Number(id_article),
      categorie: aps2024_categories.name,
      subCategorie:
        aps2024_subCategories !== null ? aps2024_subCategories.name : null,
      image:
        aps2024_images !== null
          ? {
              id_image: Number(aps2024_images.id_image),
              url: aps2024_images.url,
            }
          : null,
      ...rest,
    };
  });
  return { articles: articlesFormatted, count: totalCount };
};

// add log errors

/**
 * Creates a new article with optional block association and translations
 * @param {Object} articleData - Article creation data
 * @param {Object} [logData] - Logging data (unused in current implementation)
 * @returns {Promise<{id_article: number}>} Created article ID
 * @throws {ErrorHandler} If validation fails or required entities not found
 */
export const createArticle = async (articleData, logData) => {
  const {
    categorieId,
    subCategorieId,
    tags = [],
    imageId,
    gallerieId,
    dossierId,
    translatedArticles = [],
    blockId = null,
    is_souverainete = false,
    introtext,
    fulltext,
    ...restdata
  } = articleData;

  // Validate all related entities first
  await validateRelatedEntities({
    categorieId,
    subCategorieId,
    imageId,
    gallerieId,
    dossierId,
    tags,
    prisma,
  });

  // Handle block-related logic - require image if block is specified
  if (blockId && !imageId) {
    throw new ErrorHandler(
      404,
      `Vous ne pouvez pas créer une article dans l'accueil sans image.`
    );
  }

  // Create article
  const article = await prisma.aps2024_articles.create({
    data: createBaseArticleData({
      restdata,
      is_souverainete,
      blockId,
      categorieId,
      subCategorieId,
      imageId,
      gallerieId,
      tags,
      translatedArticles,
      dossierId,
      title: articleData.title,
      introtext,
      fulltext,
    }),
    select: { id_article: true },
  });

  return { id_article: Number(article.id_article) };
};

/**
 * Updates an existing article with complex business logic and database interactions
 *
 * @param {Object} articleData - Comprehensive article update payload
 * @param {Object} logData - Logging context for error tracking
 * @returns {Promise<string>} The title of the updated article
 *
 * @throws {ErrorHandler} Throws errors for various validation scenarios:
 * - Non-existent article
 * - Invalid related entities (categories, tags, images)
 */
export const updateArticle = async (articleData, logData) => {
  const {
    articleId,
    categorieId,
    subCategorieId,
    tags = [],
    imageId,
    gallerieId,
    dossierId,
    translatedArticles = [],
    blockId = null,
    is_souverainete,
    ...restdata
  } = articleData;

  const existingArticle = await prisma.aps2024_articles.findUnique({
    where: { id_article: articleId },
    select: {
      id_article: true,
      title: true,
      supTitle: true,
      introtext: true,
      fulltext: true,
      id_image: true,
      id_block: true,
      id_categorie: true,
      id_subCategorie: true,
      id_gallery: true,
      is_publish: true,
      is_souverainete: true,
      is_protected: true,
      locked_by: true,
      is_locked: true,
      locked_date: true,
      alias: true,
      // Include related data for comparison
      aps2024_categories: {
        select: { name: true },
      },
      aps2024_subCategories: {
        select: { name: true },
      },
      aps2024_images: {
        select: { name: true },
      },
      aps2024_gallery: {
        select: { name: true },
      },
      aps2024_blocks: {
        select: { name: true },
      },
      aps2024_article_tag: {
        select: {
          aps2024_tag: {
            select: { name: true },
          },
        },
      },
      aps2024_article_dossier: {
        select: {
          aps2024_dossiers: {
            select: { name: true },
          },
        },
      },
      aps2024_article_translated: {
        select: {
          url: true,
          aps2024_languages: {
            select: {
              id_lang: true,
              label: true,
            },
          },
        },
      },
    },
  });

  // If the article doesn't exist, throw an error
  if (!existingArticle) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'un article inexistante.
      Informations de débogage :
      ID du article demandé : ${articleId}`,
    });
    throw new ErrorHandler(404, "Article inexistante");
  }

  const now = new Date();

  const lockExpired =
    existingArticle.locked_date &&
    now - new Date(existingArticle.locked_date) >
      process.env.LOCK_TIMEOUT_MINUTES * 60 * 1000;

  // If locked by another author and not expired, deny access
  if (
    existingArticle.is_locked &&
    existingArticle.locked_by !== restdata.modified_by &&
    !lockExpired
  ) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'un article en cours d'édition par un autre auteur.
      Informations de débogage :
      ID du l'article demandé : ${articleId}
      Titre du l'article demandé : ${existingArticle.title}`,
    });
    throw new ErrorHandler(
      400,
      `Cet article est actuellement en cours d'édition par un autre auteur ${existingArticle.locked_by}.`
    );
  }

  const [
    existingCategorie,
    existingSubCategorie,
    existingImage,
    existingGallery,
    existingDossier,
  ] = await Promise.all([
    categorieId
      ? prisma.aps2024_categories.findUnique({
          where: { id_categorie: categorieId },
          select: {
            id_categorie: true,
            name: true,
            _count: {
              select: {
                aps2024_subCategories: true,
              },
            },
          },
        })
      : null,
    subCategorieId
      ? prisma.aps2024_subCategories.findUnique({
          where: {
            id_subCategorie: subCategorieId,
            id_categorie: categorieId
              ? categorieId
              : existingArticle.id_categorie,
          },
          select: {
            id_subCategorie: true,
            name: true,
          },
        })
      : null,
    imageId
      ? prisma.aps2024_images.findUnique({
          where: { id_image: imageId },
          select: {
            id_image: true,
            name: true,
          },
        })
      : null,
    gallerieId
      ? prisma.aps2024_gallery.findUnique({
          where: { id_gallery: gallerieId },
          select: {
            id_gallery: true,
            name: true,
          },
        })
      : null,
    dossierId
      ? prisma.aps2024_dossiers.findUnique({
          where: { id_dossier: dossierId },
          select: {
            id_dossier: true,
            name: true,
          },
        })
      : null,
  ]);

  categorieId && validateEntityExists(existingCategorie, "Categorie");
  if (
    categorieId &&
    existingCategorie._count.aps2024_subCategories > 0 &&
    subCategorieId == null
  ) {
    throw new ErrorHandler(
      404,
      "Vous ne pouvez pas modifier cet article avec cette catégorie sans sous-catégorie."
    );
  }
  subCategorieId && validateEntityExists(existingSubCategorie, "SubCategorie");
  imageId && validateEntityExists(existingImage, "Image");
  gallerieId && validateEntityExists(existingGallery, "Gallery");
  dossierId && validateEntityExists(existingDossier, "Dossier");

  if (tags.length) {
    const existingTags = await prisma.aps2024_tag.findMany({
      where: { id_tag: { in: tags } },
    });

    if (existingTags.length !== tags.length) {
      throw new ErrorHandler(404, "One or more tags not found");
    }
  }

  // Handle block-related logic - require image if block is specified
  if (blockId && !existingImage && !existingArticle.id_image) {
    throw new ErrorHandler(
      404,
      `Vous ne pouvez pas placer un article sur la page d'accueil n'a pas une image.`
    );
  }

  const typeArticleData =
    is_souverainete !== undefined
      ? is_souverainete == true
        ? { is_validated: false, validate_date: null }
        : { is_validated: true, validate_date: new Date() }
      : {};

  // Handle tag update
  if (tags.length !== 0) {
    const [tagDeleted, allTag] = await Promise.all([
      prisma.aps2024_article_tag.findMany({
        where: {
          id_article: articleId,
          id_tag: { notIn: tags },
        },
        select: { id_tag: true },
      }),
      prisma.aps2024_article_tag.findMany({
        where: { id_article: articleId },
        select: { id_tag: true },
      }),
    ]);

    const deletedTagsSet = new Set(tagDeleted.map((tag) => Number(tag.id_tag)));
    const existingTagsSet = new Set(allTag.map((tag) => Number(tag.id_tag)));

    const newTags = tags.filter(
      (tag) => !deletedTagsSet.has(tag) && !existingTagsSet.has(tag)
    );

    await prisma.aps2024_article_tag.deleteMany({
      where: {
        id_article: articleId,
        id_tag: { notIn: tags },
      },
    });

    if (newTags.length > 0) {
      await prisma.aps2024_article_tag.createMany({
        data: newTags.map((tagId) => ({
          id_tag: tagId,
          id_article: articleId,
          assigned_by: restdata.modified_by,
        })),
      });
    }
  }

  // Handle translated articles
  if (translatedArticles.length === 0) {
    await prisma.aps2024_article_translated.deleteMany({
      where: { id_article: articleId },
    });
  } else {
    await prisma.aps2024_article_translated.deleteMany({
      where: { id_article: articleId },
    });
    await prisma.aps2024_article_translated.createMany({
      data: translatedArticles.map((article) => ({
        id_article: articleId,
        url: article.url,
        id_lang: article.id_lang,
        created_by: restdata.modified_by,
      })),
    });
  }

  // Handle dossier association
  if (dossierId !== undefined) {
    await prisma.aps2024_article_dossier.deleteMany({
      where: { id_article: articleId },
    });

    if (dossierId !== null) {
      await prisma.aps2024_article_dossier.create({
        data: {
          id_article: articleId,
          id_dossier: dossierId,
        },
      });
    }
  }

  await prisma.aps2024_articles.update({
    where: { id_article: articleId },
    data: {
      ...restdata,
      ...typeArticleData,
      id_block: blockId,
      modified_date: new Date(),
      ...(articleData.title !== undefined && {
        alias: updateAlias(existingArticle.alias, articleData.title),
      }),
      ...(articleData.introtext !== undefined && {
        introtext: cleanHtmlContent(articleData.introtext),
      }),
      ...(articleData.fulltext !== undefined && {
        fulltext: cleanHtmlContent(articleData.fulltext),
      }),
      id_categorie: categorieId,
      id_subCategorie: subCategorieId,
      id_image: imageId,
      id_gallery: gallerieId,
      is_locked: false,
      locked_by: null,
      locked_date: null,
    },
    select: { title: true },
  });

  // Create updated data object only with fields that were actually provided
  const updatedArticleData = {
    // Keep the original article data for comparison
    ...existingArticle,
  };

  // Only update fields that were provided in the input
  if (restdata.title !== undefined) updatedArticleData.title = restdata.title;
  if (restdata.supTitle !== undefined)
    updatedArticleData.supTitle = restdata.supTitle;
  if (restdata.introtext !== undefined)
    updatedArticleData.introtext = restdata.introtext;
  if (restdata.fulltext !== undefined)
    updatedArticleData.fulltext = restdata.fulltext;
  if (is_souverainete !== undefined)
    updatedArticleData.is_souverainete = is_souverainete;
  if (restdata.is_protected !== undefined)
    updatedArticleData.is_protected = restdata.is_protected;

  // Handle related entities only if they were provided
  if (categorieId !== undefined) {
    updatedArticleData.aps2024_categories = existingCategorie
      ? { name: existingCategorie.name }
      : null;
  }
  if (subCategorieId !== undefined) {
    updatedArticleData.aps2024_subCategories = existingSubCategorie
      ? { name: existingSubCategorie.name }
      : null;
  }
  if (imageId !== undefined) {
    updatedArticleData.aps2024_images = existingImage
      ? { name: existingImage.name }
      : null;
  }
  if (gallerieId !== undefined) {
    updatedArticleData.aps2024_gallery = existingGallery
      ? { name: existingGallery.name }
      : null;
  }
  if (blockId !== undefined) {
    if (blockId === null) {
      updatedArticleData.aps2024_blocks = null;
    } else {
      // Fetch the actual block name
      const block = await prisma.aps2024_blocks.findUnique({
        where: { id_block: blockId },
        select: { name: true },
      });
      updatedArticleData.aps2024_blocks = block
        ? { name: block.name }
        : { name: `Block ${blockId}` };
    }
  }

  // Handle tags only if provided
  if (tags.length > 0) {
    updatedArticleData.aps2024_article_tag = await Promise.all(
      tags.map(async (tagId) => {
        const tag = await prisma.aps2024_tag.findUnique({
          where: { id_tag: tagId },
          select: { name: true },
        });
        return { aps2024_tag: { name: tag?.name || `Tag ${tagId}` } };
      })
    );
  }

  // Handle dossier only if provided
  if (dossierId !== undefined) {
    if (dossierId === null) {
      updatedArticleData.aps2024_article_dossier = [];
    } else {
      updatedArticleData.aps2024_article_dossier = [
        {
          aps2024_dossiers: {
            name: existingDossier?.name || `Dossier ${dossierId}`,
          },
        },
      ];
    }
  }

  // Handle translated articles only if provided
  if (translatedArticles.length > 0) {
    updatedArticleData.aps2024_article_translated = await Promise.all(
      translatedArticles.map(async (article) => {
        const lang = await prisma.aps2024_languages.findUnique({
          where: { id_lang: article.id_lang },
          select: { label: true },
        });
        return {
          url: article.url,
          aps2024_languages: {
            label: lang?.label || `Lang ${article.id_lang}`,
          },
        };
      })
    );
  }

  // Pass the original input data to track what was actually changed
  const logMessage = generateArticleLogMessage(
    existingArticle,
    updatedArticleData,
    articleData
  );

  console.log(logMessage);
  return logMessage;
};
export const pinArticle = async (articleData, logData) => {
  const {
    articleId,
    is_pinned,
    blockId,
    position,
    categorieId = null,
    subCategorieId = null,
    modified_by,
  } = articleData;

  const existingArticle = await prisma.aps2024_articles.findUnique({
    where: { id_article: articleId },
    select: {
      id_article: true,
      title: true,
      is_publish: true,
      is_pinned: true,
      id_image: true,
      id_block: true,
      is_locked: true,
      locked_by: true,
      locked_date: true,
    },
  });

  // If the article doesn't exist, throw an error
  if (!existingArticle) {
    logger.error({
      ...logData,
      message: `Une tentative d'épingler un article inexistante.
      Informations de débogage :
      ID du article demandé : ${articleId}`,
    });
    throw new ErrorHandler(404, "Article inexistante");
  }

  const now = new Date();

  const lockExpired =
    existingArticle.locked_date &&
    now - new Date(existingArticle.locked_date) >
      process.env.LOCK_TIMEOUT_MINUTES * 60 * 1000;

  // If locked by another author and not expired, deny access
  if (
    existingArticle.is_locked &&
    existingArticle.locked_by !== modified_by &&
    !lockExpired
  ) {
    logger.error({
      ...logData,
      message: `Une tentative d'epinglement d'un article en cours d'édition par un autre auteur.
      Informations de débogage :
      ID du l'article demandé : ${articleId}
      Titre du l'article demandé : ${existingArticle.title}`,
    });
    throw new ErrorHandler(
      400,
      `Cet article est actuellement en cours d'édition par un autre auteur ${existingArticle.locked_by}.`
    );
  }

  if (!existingArticle.is_publish) {
    logger.error({
      ...logData,
      message: `Une tentative d'épingler un article non publié.
      Informations de débogage :
      ID du article demandé : ${articleId}
      Titre du article demandé : ${existingArticle.title}`,
    });
    throw new ErrorHandler(
      404,
      "Vous ne pouvez pas épingler un article non publié."
    );
  }

  // Parallel existence checks
  const [existingCategorie, existingSubCategorie] = await Promise.all([
    categorieId
      ? prisma.aps2024_categories.findUnique({
          where: { id_categorie: categorieId },
        })
      : null,
    subCategorieId
      ? prisma.aps2024_subCategories.findUnique({
          where: { id_subCategorie: subCategorieId, id_categorie: categorieId },
        })
      : null,
  ]);

  // Error handling for non-existent related entities
  if (categorieId && !existingCategorie)
    throw new ErrorHandler(404, "No Categorie found");
  if (subCategorieId && !existingSubCategorie)
    throw new ErrorHandler(404, "No SubCategorie found");

  if (!is_pinned && !existingArticle.is_pinned) {
    throw new ErrorHandler(
      404,
      "Vous ne pouvez pas dépingler un article déja dépingler."
    );
  }

  // Check if article is already pinned in ANY position across both tables
  const [existingPinInActualites, existingPinInGeneral] = await Promise.all([
    prisma.aps2024_block_position_actualites.findFirst({
      where: {
        id_article: articleId,
      },
    }),
    prisma.aps2024_block_position.findFirst({
      where: {
        id_article: articleId,
      },
    }),
  ]);

  if (blockId == 3) {
    if (is_pinned) {
      if (existingArticle.id_image == null) {
        throw new ErrorHandler(
          404,
          `Vous ne pouvez pas épingler un article sur la page d'accueil n'a pas une image.`
        );
      }

      await prisma.$transaction(async (prisma) => {
        const existingPosition =
          await prisma.aps2024_block_position_actualites.findFirst({
            where: {
              id_block: blockId,
              position: position,
              id_categorie: categorieId,
              id_subCategorie: subCategorieId,
            },
          });

        if (!existingPosition) {
          // Get block info for better error message
          const existingBlock = await prisma.aps2024_blocks.findUnique({
            where: { id_block: blockId },
          });
          throw new ErrorHandler(
            400,
            `La position ${position} n'est pas valide pour le bloc ${
              existingBlock?.name || blockId
            } pour la catégorie.`
          );
        }

        if (existingPosition?.id_article) {
          // Unpin the existing article in the position we want to replace it with other article
          await prisma.aps2024_articles.update({
            where: { id_article: existingPosition.id_article },
            data: { is_pinned: false },
          });
        }

        // Unpin the article if it's already pinned in another position (in actualites)
        if (
          existingPinInActualites &&
          existingPinInActualites.id_block_position_actualites !==
            existingPosition.id_block_position_actualites
        ) {
          await prisma.aps2024_block_position_actualites.update({
            where: {
              id_block_position_actualites:
                existingPinInActualites.id_block_position_actualites,
            },
            data: {
              aps2024_articles: {
                disconnect: true,
              },
            },
          });
        }

        // Unpin the article if it's pinned in general block positions
        if (existingPinInGeneral) {
          await prisma.aps2024_block_position.update({
            where: {
              id_blocPosition: existingPinInGeneral.id_blocPosition,
            },
            data: {
              aps2024_articles: {
                disconnect: true,
              },
            },
          });
        }

        // pin the new article provided
        await prisma.aps2024_articles.update({
          where: { id_article: existingArticle.id_article },
          data: { is_pinned: true, id_block: blockId },
        });

        // update the block position with the new article
        await prisma.aps2024_block_position_actualites.update({
          where: {
            id_block_position_actualites:
              existingPosition.id_block_position_actualites,
          },
          data: {
            aps2024_articles: {
              connect: {
                id_article: articleId,
              },
            },
          },
        });
      });
    } else {
      await prisma.$transaction(async (prisma) => {
        // set article is pinned to false
        await prisma.aps2024_articles.update({
          where: { id_article: articleId },
          data: { is_pinned: false },
        });

        // Find and unpin from actualites table
        const pinnedPositionActualites =
          await prisma.aps2024_block_position_actualites.findFirst({
            where: {
              id_article: articleId,
            },
          });

        if (pinnedPositionActualites) {
          await prisma.aps2024_block_position_actualites.update({
            where: {
              id_block_position_actualites:
                pinnedPositionActualites.id_block_position_actualites,
            },
            data: {
              aps2024_articles: {
                disconnect: true,
              },
            },
          });
        }

        // Also check and unpin from general block positions table
        const pinnedPositionGeneral =
          await prisma.aps2024_block_position.findFirst({
            where: {
              id_article: articleId,
            },
          });

        if (pinnedPositionGeneral) {
          await prisma.aps2024_block_position.update({
            where: {
              id_blocPosition: pinnedPositionGeneral.id_blocPosition,
            },
            data: {
              aps2024_articles: {
                disconnect: true,
              },
            },
          });
        }
      });
    }
  } else if (blockId == 2 || blockId == 1) {
    if (is_pinned) {
      if (existingArticle.id_image == null) {
        throw new ErrorHandler(
          404,
          `Vous ne pouvez pas épingler un article sur la page d'accueil n'a pas une image.`
        );
      }
      await prisma.$transaction(async (prisma) => {
        const existingPosition = await prisma.aps2024_block_position.findFirst({
          where: {
            id_block: blockId,
            position: position,
          },
        });

        if (!existingPosition) {
          // Get block info for better error message
          const existingBlock = await prisma.aps2024_blocks.findUnique({
            where: { id_block: blockId },
          });
          throw new ErrorHandler(
            404,
            `Position ${position} is invalid for block ${
              existingBlock?.name || blockId
            } for category.`
          );
        }

        if (existingPosition?.id_article) {
          // Unpin the existing article in the position we want to replace it with other article
          await prisma.aps2024_articles.update({
            where: { id_article: existingPosition.id_article },
            data: { is_pinned: false },
          });
        }

        // Unpin the article if it's already pinned in another position (in general positions)
        if (
          existingPinInGeneral &&
          existingPinInGeneral.id_blocPosition !==
            existingPosition.id_blocPosition
        ) {
          await prisma.aps2024_block_position.update({
            where: {
              id_blocPosition: existingPinInGeneral.id_blocPosition,
            },
            data: {
              aps2024_articles: {
                disconnect: true,
              },
            },
          });
        }

        // Unpin the article if it's pinned in actualites table
        if (existingPinInActualites) {
          await prisma.aps2024_block_position_actualites.update({
            where: {
              id_block_position_actualites:
                existingPinInActualites.id_block_position_actualites,
            },
            data: {
              aps2024_articles: {
                disconnect: true,
              },
            },
          });
        }

        // pin the new article provided
        await prisma.aps2024_articles.update({
          where: { id_article: existingArticle.id_article },
          data: { is_pinned: true, id_block: blockId },
        });

        // update the block position with the new article
        await prisma.aps2024_block_position.update({
          where: {
            id_blocPosition: existingPosition.id_blocPosition,
          },
          data: {
            aps2024_articles: {
              connect: {
                id_article: articleId,
              },
            },
          },
        });
      });
    } else {
      await prisma.$transaction(async (prisma) => {
        // set article is pinned to false
        await prisma.aps2024_articles.update({
          where: { id_article: articleId },
          data: { is_pinned: false },
        });

        // Find and unpin from general positions table
        const pinnedPosition = await prisma.aps2024_block_position.findFirst({
          where: {
            id_article: articleId,
          },
        });

        if (pinnedPosition) {
          await prisma.aps2024_block_position.update({
            where: {
              id_blocPosition: pinnedPosition.id_blocPosition,
            },
            data: {
              aps2024_articles: {
                disconnect: true,
              },
            },
          });
        }

        // Find and unpin from actualites table
        const pinnedPositionActualites =
          await prisma.aps2024_block_position_actualites.findFirst({
            where: {
              id_article: articleId,
            },
          });

        if (pinnedPositionActualites) {
          await prisma.aps2024_block_position_actualites.update({
            where: {
              id_block_position_actualites:
                pinnedPositionActualites.id_block_position_actualites,
            },
            data: {
              aps2024_articles: {
                disconnect: true,
              },
            },
          });
        }
      });
    }
  }

  const updatedHomeBlockArticles = await fetchArticlesForBlock({
    categorieId,
    subCategorieId,
  });

  return {
    title: existingArticle.title,
    articles: updatedHomeBlockArticles,
  };
};

export const publishArticle = async (articleData, loggedUser, logData) => {
  const { articleId, publish_by, publish_date } = articleData;

  const existingArticle = await prisma.aps2024_articles.findUnique({
    where: { id_article: articleId },
    select: {
      id_article: true,
      title: true,
      id_block: true,
      is_publish: true,
      is_pinned: true,
      is_souverainete: true,
      is_validated: true,
      id_image: true,
      locked_by: true,
      locked_date: true,
    },
  });
  // If the article doesn't exist, throw an error
  if (!existingArticle) {
    logger.error({
      ...logData,
      message: `Une tentative du publication d'un article inexistante.
      Informations de débogage :
      ID du article demandé : ${articleId}`,
    });
    throw new ErrorHandler(404, "Article inexistante");
  }

  const now = new Date();

  const lockExpired =
    existingArticle.locked_date &&
    now - new Date(existingArticle.locked_date) >
      process.env.LOCK_TIMEOUT_MINUTES * 60 * 1000;

  // If locked by another author and not expired, deny access
  if (
    existingArticle.is_locked &&
    existingArticle.locked_by !== restdata.publish_by &&
    !lockExpired
  ) {
    logger.error({
      ...logData,
      message: `Une tentative de publication d'un article en cours d'édition par un autre auteur.
      Informations de débogage :
      ID du l'article demandé : ${articleId}
      Titre du l'article demandé : ${existingArticle.title}`,
    });

    throw new ErrorHandler(
      400,
      `Cet article est actuellement en cours d'édition par un autre auteur ${existingArticle.locked_by}.`
    );
  }

  if (existingArticle.is_publish) {
    logger.error({
      ...logData,
      message: `Une tentative de publication d'un article déjà publié.
      Informations de débogage :
      ID du l'article demandé : ${articleId}
      Titre du l'article demandé : ${existingArticle.title}`,
    });
    throw new ErrorHandler(
      404,
      "Vous ne pouvez pas publier un article déjà publié"
    );
  }

  if (publish_date !== undefined && new Date(publish_date) < new Date()) {
    logger.error({
      ...logData,
      message: `Une tentative du publication d'un article une date de publication antérieure à aujourd'hui a été interceptée.
      Informations de débogage :
      ID du article demandé : ${articleId}
      Date de publication fournie : ${publish_date}`,
    });

    throw new ErrorHandler(
      404,
      "La date de publication ne peut pas être dans le passé."
    );
  }

  if (!existingArticle.is_validated && existingArticle.is_souverainete) {
    // Check if the logged user has the role "Rédacteur en chef" or "Admin"
    // who doesn't need article to be validated to publish it
    const hasRequiredRole =
      loggedUser.activeRoles.includes("Rédacteur en chef") ||
      loggedUser.activeRoles.includes("SuperUser") ||
      loggedUser.activeRoles.includes("Admin");

    if (!hasRequiredRole) {
      logger.error({
        ...logData,
        message: `Une tentative du publication d'un article souverainete nécessite une validation par le directeur général.
        Informations de débogage :
        ID du l'article demandé : ${articleId}
        Titre du l'article demandé : ${existingArticle.title}`,
      });
      throw new ErrorHandler(
        404,
        "Vous ne pouvez pas publier cet article, il nécessite une validation par le directeur général."
      );
    }
  }

  // test if publication is programmed
  const publishData =
    publish_date !== undefined
      ? { publish_date: publish_date, is_publish: false, is_programmed: true }
      : { publish_date: new Date(), is_publish: true, is_programmed: false };

  if (existingArticle.id_image == null && existingArticle.id_block !== null) {
    logger.error({
      ...logData,
      message: `Une tentative de publication un article la page d'accueil sans image.
    Informations de débogage :
    ID du article demandé : ${articleId}
    Titre du l'article demandé : ${existingArticle.title}`,
    });
    throw new ErrorHandler(
      404,
      `Vous ne pouvez pas publie un article sur la page d'accueil n'a pas une image.`
    );
  }

  if (publish_date !== undefined) {
    logger.error({
      ...logData,
      message: `Une tentative de publication avec une date programmée d'un article épinglé.
        Informations de débogage :
        ID du article demandé : ${articleId}
        Titre du l'article demandé : ${existingArticle.title}`,
    });
    throw new ErrorHandler(
      404,
      "Vous ne pouvez pas publier une publication épinglée avec une date programmée."
    );
  }

  await prisma.aps2024_articles.update({
    where: {
      id_article: articleId,
    },
    data: {
      ...publishData,
      publish_by: publish_by,
      validate_date: new Date(),
      is_validated: true,
    },
  });

  return existingArticle.title;
};

export const unPublishArticle = async (articleData, logData) => {
  const { articleId, unPublish_by } = articleData;
  const existingArticle = await prisma.aps2024_articles.findUnique({
    where: { id_article: articleId },
    select: {
      id_article: true,
      title: true,
      is_pinned: true,
      id_block: true,
    },
  });

  // If the article doesn't exist, throw an error
  if (!existingArticle) {
    logger.error({
      ...logData,
      message: `Une tentative du dépublication d'un article inexistante.
      Informations de débogage :
      ID du article demandé : ${articleId}`,
    });
    throw new ErrorHandler(404, "Article inexistante");
  }

  console.log("Unpublishing article:", articleId, existingArticle);

  await prisma.$transaction(async (prisma) => {
    if (existingArticle.id_block === 3) {
      // Check if record exists in aps2024_block_position_actualites before updating
      const actualitePosition =
        await prisma.aps2024_block_position_actualites.findUnique({
          where: { id_article: articleId },
        });

      if (actualitePosition) {
        await prisma.aps2024_block_position_actualites.update({
          where: { id_article: articleId },
          data: {
            aps2024_articles: {
              disconnect: true,
            },
          },
        });
      }
    } else if (
      existingArticle.id_block === 1 ||
      existingArticle.id_block === 2
    ) {
      console.log("Unpinning from general block positions", articleId);

      // Check if record exists in aps2024_block_position before updating
      const blockPosition = await prisma.aps2024_block_position.findUnique({
        where: { id_article: articleId },
      });

      if (blockPosition) {
        await prisma.aps2024_block_position.update({
          where: { id_article: articleId },
          data: {
            aps2024_articles: {
              disconnect: true,
            },
          },
        });
      }
    }

    // Always update the article regardless of position table records
    await prisma.aps2024_articles.update({
      where: {
        id_article: articleId,
      },
      data: {
        is_publish: false,
        is_programmed: false,
        is_pinned: false,
        unpublish_by: unPublish_by,
        publish_down: new Date(),
      },
    });
  });

  return existingArticle.title;
};

export const sendArticleToTrash = async (articleData, logData) => {
  const { articleId, trash_by } = articleData;

  const existingArticle = await prisma.aps2024_articles.findUnique({
    where: { id_article: articleId },
    select: {
      title: true,
      is_publish: true,
      publish_down: true,
    },
  });

  // If the article doesn't exist, throw an error
  if (!existingArticle) {
    logger.error({
      ...logData,
      message: `Une tentative d'envoi d'un article inexistant à la corbeille.
      Informations de débogage :
      ID du article demandé : ${articleId}`,
    });
    throw new ErrorHandler(404, "Article inexistante");
  }

  if (existingArticle.is_publish || existingArticle.publish_down != undefined) {
    logger.error({
      ...logData,
      message: `Une tentative d'envoi d'un article déjà publié à la corbeille.
      Informations de débogage :
      ID du article demandé : ${articleId}`,
    });
    throw new ErrorHandler(
      404,
      "Vous pouvez uniquement envoyer un article non publié à la corbeille."
    );
  }

  await prisma.aps2024_articles.update({
    where: {
      id_article: articleId,
    },
    data: {
      is_trash: true,
      trash_by: trash_by,
    },
  });

  return existingArticle.title;
};

export const toggleArticleLock = async (articleData, logData) => {
  const { articleId, locked_by } = articleData;

  return await prisma.$transaction(async (prisma) => {
    const existingArticle = await prisma.aps2024_articles.findUnique({
      where: { id_article: articleId },
      select: {
        title: true,
        is_locked: true,
        locked_date: true,
        locked_by: true,
      },
    });

    // If the article doesn't exist, throw an error
    if (!existingArticle) {
      logger.error({
        ...logData,
        message: `Une tentative de verrouillage un article inexistant .
      Informations de débogage :
      ID du article demandé : ${articleId}`,
      });
      throw new ErrorHandler(404, "Article inexistante");
    }

    const now = new Date();

    const lockExpired =
      existingArticle.locked_date &&
      now - new Date(existingArticle.locked_date) >
        process.env.LOCK_TIMEOUT_MINUTES * 60 * 1000;

    // If locked by another author and not expired, deny access
    if (
      existingArticle.is_locked &&
      existingArticle.locked_by !== locked_by &&
      !lockExpired
    ) {
      logger.error({
        ...logData,
        message: `Une tentative de verrouillage d'un article en cours d'édition par un autre auteur.
      Informations de débogage :
      ID du l'article demandé : ${articleId}
      Titre du l'article demandé : ${existingArticle.title}`,
      });

      throw new ErrorHandler(
        400,
        `Cet article est actuellement en cours d'édition par un autre auteur ${existingArticle.locked_by}.`
      );
    }

    // If locked by this author or the lock expired, toggle the lock
    const isLocking = !existingArticle.is_locked || lockExpired;
    await prisma.aps2024_articles.update({
      where: { id_article: articleId },
      data: {
        is_locked: isLocking,
        locked_by: isLocking ? locked_by : null,
        locked_date: isLocking ? new Date() : null,
      },
    });

    return existingArticle.title;
  });
};

// helper function
function transformObject(input) {
  const output = {};

  const directProps = [
    "is_trash",
    "is_publish",
    "id_user",
    "is_pinned",
    "id_categorie",
    "is_validated",
    "id_subCategorie",
  ];
  const nestedProps = {
    id_tag: "aps2024_article_tag",
    id_dossier: "aps2024_article_dossier",
  };

  // Set is_trash to false by default if it doesn't exist
  output.is_trash = input.is_trash !== undefined ? input.is_trash : false;

  // Assign direct properties if they exist in the input
  directProps.forEach((prop) => {
    if (input[prop] !== undefined) {
      output[prop] = input[prop];
    }
  });

  // Assign nested properties if they exist in the input
  Object.keys(nestedProps).forEach((prop) => {
    if (input[prop] !== undefined) {
      output[nestedProps[prop]] = { some: { [prop]: input[prop] } };
    }
  });

  return output;
}

function extractIDFromURL(url) {
  // Extract the last path segment from the URL
  const lastSegment = url.split("/").pop();

  // Match the part before the first hyphen
  const match = lastSegment.match(/^([a-zA-Z0-9]+)-/);

  if (match) {
    return match[1];
  } else {
    return null;
  }
}

// Centralized entity validation with precise error messages
const validateEntityExists = (entity, entityName) => {
  if (entity === null) {
    throw new ErrorHandler(404, `${entityName} not found`);
  }
};

/**
 * Validates the existence of all related entities for an article
 */
const validateRelatedEntities = async ({
  categorieId,
  subCategorieId,
  imageId,
  gallerieId,
  dossierId,
  tags,
  prisma,
}) => {
  const [
    existingCategorie,
    existingSubCategorie,
    existingImage,
    existingGallery,
    existingDossier,
  ] = await Promise.all([
    prisma.aps2024_categories.findUnique({
      where: { id_categorie: categorieId },
      select: {
        _count: {
          select: {
            aps2024_subCategories: true,
          },
        },
      },
    }),
    subCategorieId
      ? prisma.aps2024_subCategories.findUnique({
          where: {
            id_subCategorie: subCategorieId,
            id_categorie: categorieId,
          },
        })
      : null,
    imageId
      ? prisma.aps2024_images.findUnique({
          where: { id_image: imageId },
        })
      : null,
    gallerieId
      ? prisma.aps2024_gallery.findUnique({
          where: { id_gallery: gallerieId },
        })
      : null,
    dossierId
      ? prisma.aps2024_dossiers.findUnique({
          where: { id_dossier: dossierId },
        })
      : null,
  ]);

  if (!existingCategorie) {
    throw new ErrorHandler(404, "No Categorie found");
  }

  if (
    existingCategorie._count.aps2024_subCategories > 0 &&
    subCategorieId == null
  ) {
    throw new ErrorHandler(
      404,
      "Vous ne pouvez pas créer cet article avec cette catégorie sans sous-catégorie."
    );
  }

  if (subCategorieId && !existingSubCategorie) {
    throw new ErrorHandler(404, "No SubCategorie found");
  }
  if (imageId && !existingImage) {
    throw new ErrorHandler(404, "No Image found");
  }
  if (gallerieId && !existingGallery) {
    throw new ErrorHandler(404, "No Gallery found");
  }
  if (dossierId && !existingDossier) {
    throw new ErrorHandler(404, "No Dossier found");
  }

  if (tags?.length) {
    const existingTags = await prisma.aps2024_tag.findMany({
      where: { id_tag: { in: tags } },
    });
    if (existingTags.length !== tags.length) {
      throw new ErrorHandler(404, "One or more tags not found");
    }
  }
};

/**
 * Prepares base article data for database insertion
 */
const createBaseArticleData = ({
  restdata,
  is_souverainete,
  blockId,
  categorieId,
  subCategorieId,
  imageId,
  gallerieId,
  tags,
  translatedArticles,
  dossierId,
  title,
  introtext,
  fulltext,
}) => ({
  ...restdata,
  ...(!is_souverainete && {
    is_validated: true,
    validate_date: new Date(),
  }),
  introtext: cleanHtmlContent(introtext),
  fulltext: cleanHtmlContent(fulltext),
  is_souverainete,
  id_block: blockId,
  alias: createAlias(title),
  id_categorie: categorieId,
  id_subCategorie: subCategorieId,
  id_image: imageId,
  id_gallery: gallerieId,
  aps2024_article_tag:
    tags.length > 0
      ? {
          createMany: {
            data: tags.map((tagId) => ({
              id_tag: tagId,
              assigned_by: restdata.created_by,
            })),
          },
        }
      : undefined,
  aps2024_article_translated:
    translatedArticles.length > 0
      ? {
          createMany: {
            data: translatedArticles.map((article) => ({
              url: article.url,
              id_lang: article.id_lang,
              created_by: restdata.created_by,
            })),
          },
        }
      : undefined,
  ...(dossierId !== undefined && {
    aps2024_article_dossier: {
      create: {
        id_dossier: dossierId,
      },
    },
  }),
});

function generateArticleLogMessage(oldArticle, updatedArticle, inputData) {
  const changes = [];

  // Field mappings for better readability
  const fieldMapping = {
    title: "Titre",
    supTitle: "Sur-titre",
    introtext: "Texte d'introduction",
    fulltext: "Texte complet",
    is_souverainete: "Article de souveraineté",
    is_protected: "Article protégé",
  };

  // Helper function to find differences in text and show only changed parts
  function getTextDifference(oldText, newText, maxLength = 100) {
    if (!oldText && !newText) return null;

    // Clean both texts for comparison
    const cleanedOldText = cleanHtmlContent(oldText || "");
    const cleanedNewText = cleanHtmlContent(newText || "");

    if (!cleanedOldText && !cleanedNewText) return null;
    if (!cleanedOldText)
      return `"" → "...${cleanedNewText.substring(0, maxLength)}${
        cleanedNewText.length > maxLength ? "..." : ""
      }"`;
    if (!cleanedNewText)
      return `"...${cleanedOldText.substring(0, maxLength)}${
        cleanedOldText.length > maxLength ? "..." : ""
      }" → ""`;

    // If cleaned texts are identical, return null
    if (cleanedOldText === cleanedNewText) return null;

    // Continue with the rest of the function using cleaned texts...
    const oldWords = cleanedOldText.split(" ");
    const newWords = cleanedNewText.split(" ");

    // Find first difference
    let firstDiffIndex = 0;
    while (
      firstDiffIndex < Math.min(oldWords.length, newWords.length) &&
      oldWords[firstDiffIndex] === newWords[firstDiffIndex]
    ) {
      firstDiffIndex++;
    }

    // Find last difference
    let lastDiffIndexOld = oldWords.length - 1;
    let lastDiffIndexNew = newWords.length - 1;
    while (
      lastDiffIndexOld >= firstDiffIndex &&
      lastDiffIndexNew >= firstDiffIndex &&
      oldWords[lastDiffIndexOld] === newWords[lastDiffIndexNew]
    ) {
      lastDiffIndexOld--;
      lastDiffIndexNew--;
    }

    // Extract context around the difference
    const contextWords = 10; // Number of words to show before and after the change
    const startIndex = Math.max(0, firstDiffIndex - contextWords);
    const endIndexOld = Math.min(
      oldWords.length,
      lastDiffIndexOld + contextWords + 1
    );
    const endIndexNew = Math.min(
      newWords.length,
      lastDiffIndexNew + contextWords + 1
    );

    const oldContext = oldWords.slice(startIndex, endIndexOld).join(" ");
    const newContext = newWords.slice(startIndex, endIndexNew).join(" ");

    const oldPrefix = startIndex > 0 ? "..." : "";
    const oldSuffix = endIndexOld < oldWords.length ? "..." : "";
    const newPrefix = startIndex > 0 ? "..." : "";
    const newSuffix = endIndexNew < newWords.length ? "..." : "";

    return `"${oldPrefix}${oldContext}${oldSuffix}" → "${newPrefix}${newContext}${newSuffix}"`;
  }

  // Compare basic fields ONLY if they were provided in input
  for (const key in inputData) {
    if (key === "articleId" || key.startsWith("aps2024_") || key.endsWith("Id"))
      continue;

    // Skip relation fields
    if (["tags", "translatedArticles"].includes(key)) continue;

    let oldValue = oldArticle[key];
    let newValue = updatedArticle[key];

    // Special handling for text fields (introtext and fulltext)
    if (key === "introtext" || key === "fulltext") {
      const textDiff = getTextDifference(oldValue, newValue);
      if (textDiff) {
        const fieldName = fieldMapping[key] || key;
        changes.push(`${fieldName}: ${textDiff}`);
      }
      continue;
    }

    // Handle boolean values
    if (typeof oldValue === "boolean" || typeof newValue === "boolean") {
      oldValue = oldValue ? "Oui" : "Non";
      newValue = newValue ? "Oui" : "Non";
    }

    // Handle null/undefined values
    oldValue = oldValue ?? "non défini";
    newValue = newValue ?? "non défini";

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      const fieldName = fieldMapping[key] || key;
      changes.push(`${fieldName}: "${oldValue}" → "${newValue}"`);
    }
  }

  // Compare related entities ONLY if they were provided in input
  const relatedComparisons = [
    {
      field: "Catégorie",
      inputKey: "categorieId",
      oldValue: oldArticle.aps2024_categories?.name,
      newValue: updatedArticle.aps2024_categories?.name,
    },
    {
      field: "Sous-catégorie",
      inputKey: "subCategorieId",
      oldValue: oldArticle.aps2024_subCategories?.name,
      newValue: updatedArticle.aps2024_subCategories?.name,
    },
    {
      field: "Image",
      inputKey: "imageId",
      oldValue: oldArticle.aps2024_images?.name,
      newValue: updatedArticle.aps2024_images?.name,
    },
    {
      field: "Galerie",
      inputKey: "gallerieId",
      oldValue: oldArticle.aps2024_gallery?.name,
      newValue: updatedArticle.aps2024_gallery?.name,
    },
    {
      field: "Bloc",
      inputKey: "blockId",
      oldValue: oldArticle.aps2024_blocks?.name,
      newValue: updatedArticle.aps2024_blocks?.name,
    },
  ];

  relatedComparisons.forEach(({ field, inputKey, oldValue, newValue }) => {
    // Only compare if the field was provided in input
    if (inputData[inputKey] !== undefined) {
      oldValue = oldValue ?? "non défini";
      newValue = newValue ?? "non défini";

      if (oldValue !== newValue) {
        changes.push(`${field}: "${oldValue}" → "${newValue}"`);
      }
    }
  });

  // Compare tags ONLY if provided in input
  if (inputData.tags !== undefined && inputData.tags.length > 0) {
    const oldTags =
      oldArticle.aps2024_article_tag
        ?.map((at) => at.aps2024_tag.name)
        .join(", ") || "aucun";
    const newTags =
      updatedArticle.aps2024_article_tag
        ?.map((at) => at.aps2024_tag.name)
        .join(", ") || "aucun";
    if (oldTags !== newTags) {
      changes.push(`Tags: "${oldTags}" → "${newTags}"`);
    }
  }

  // Compare dossier ONLY if provided in input
  if (inputData.dossierId !== undefined) {
    const oldDossier =
      oldArticle.aps2024_article_dossier?.[0]?.aps2024_dossiers?.name ||
      "aucun";
    const newDossier =
      updatedArticle.aps2024_article_dossier?.[0]?.aps2024_dossiers?.name ||
      "aucun";
    if (oldDossier !== newDossier) {
      changes.push(`Dossier: "${oldDossier}" → "${newDossier}"`);
    }
  }

  // Compare translated articles ONLY if provided in input
  if (inputData.translatedArticles !== undefined) {
    const oldTranslated =
      oldArticle.aps2024_article_translated
        ?.map((at) => `${at.aps2024_languages.label}: ${at.url}`)
        .join(", ") || "aucun";
    const newTranslated =
      updatedArticle.aps2024_article_translated
        ?.map((at) => `${at.aps2024_languages.label}: ${at.url}`)
        .join(", ") || "aucun";
    if (oldTranslated !== newTranslated) {
      changes.push(
        `Articles traduits: "${oldTranslated}" → "${newTranslated}"`
      );
    }
  }

  if (changes.length > 0) {
    return `L'article "${oldArticle.title}" a été modifié avec succès :
     ${changes.join(", \n ")}`;
  }

  return `Aucun changement détecté pour l'article "${oldArticle.title}".`;
}

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
