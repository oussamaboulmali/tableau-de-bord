import prisma from "../configs/database.js";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";

const logger = infoLogger("tags");
export const getAllTagsWithPaginations = async (data) => {
  const { pageSize, page, order = { created_date: "desc" } } = data;

  const offset = (page - 1) * pageSize;

  const tags = await prisma.aps2024_tag.findMany({
    take: parseInt(pageSize),
    skip: parseInt(offset),
    orderBy: [order],
  });

  const tagCount = await prisma.aps2024_tag.count();

  const tagsFormatted = tags.map((tag) => {
    const { id_session, id_tag, ...rest } = tag;
    return {
      id_tag: Number(id_tag),
      ...rest,
    };
  });

  return { tags: tagsFormatted, count: tagCount };
};

export const getAllTags = async ({ articleId }) => {
  const tags = await prisma.aps2024_tag.findMany({
    orderBy: { created_date: "desc" },
    ...(articleId !== undefined && {
      where: {
        aps2024_article_tag: {
          none: {
            id_article: articleId,
          },
        },
      },
    }),
  });

  const tagsFormatted = tags.map((tag) => {
    const { id_session, id_tag, ...rest } = tag;
    return {
      id_tag: Number(id_tag),
      ...rest,
    };
  });

  return tagsFormatted;
};
export const getArticlesOfTag = async ({ tagId }) => {
  const articles = await prisma.aps2024_article_tag.findMany({
    where: {
      id_tag: tagId,
      aps2024_articles: {
        is_publish: true,
        is_trash: false,
      },
    },
    select: {
      aps2024_articles: {
        select: {
          id_article: true,
          aps2024_categories: {
            select: {
              name: true,
            },
          },
          title: true,
        },
      },
    },
  });

  const articlesFormated = articles.map((article) => {
    const { aps2024_categories, id_article, title } = article.aps2024_articles;
    return {
      id_article: Number(id_article),
      category: aps2024_categories.name,
      title: title,
    };
  });

  return articlesFormated;
};

export const searchTag = async ({ searchText, pageSize, page }) => {
  // Calculate offset based on page and pageSize
  const offset = pageSize * (page - 1);

  if (searchText == "") {
    const { tags, count } = await getAllTagsWithPaginations({ pageSize, page });
    return { tags, count };
  }
  // Search for tag by name with pagination
  const tags = await prisma.aps2024_tag.findMany({
    where: {
      OR: [
        {
          name: {
            contains: searchText,
            mode: "insensitive", // Case-insensitive search
          },
        },
        {
          created_by: {
            contains: searchText,
            mode: "insensitive", // Case-insensitive search
          },
        },
      ],
    },
    take: pageSize, // Limit number of results per page
    skip: offset, // Skip results based on page and pageSize
    distinct: "id_tag",
  });
  // Get total count of results
  const totalCount = await prisma.aps2024_tag.count({
    where: {
      OR: [
        {
          name: {
            contains: searchText,
            mode: "insensitive", // Case-insensitive search
          },
        },
        {
          created_by: {
            contains: searchText,
            mode: "insensitive", // Case-insensitive search
          },
        },
      ],
    },
  });

  const tagsFormatted = tags.map((tag) => {
    const { id_session, id_tag, ...rest } = tag;
    return {
      id_tag: Number(id_tag),
      ...rest,
    };
  });

  return { tags: tagsFormatted, count: totalCount };
};

export const createTag = async (tagData, logData) => {
  const { name, ...data } = tagData;

  // Check if name is already taken
  const existingName = await prisma.aps2024_tag.findFirst({
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
      message: `Une tentative de créer un nouveau tag avec un nom ${existingName.name} déjà pris.
      Informations de débogage :
      Nom demandé : ${name}`,
    });
    throw new ErrorHandler(401, "Nom déjà pris");
  }

  const tag = await prisma.aps2024_tag.create({
    data: {
      ...data,
      name: name,
      alias: createAlias(name),
    },
    select: {
      id_tag: true,
      name: true,
      alias: true,
    },
  });

  return {
    ...tag,
    id_tag: Number(tag.id_tag),
  };
};

export const updateTag = async (userdata, logData) => {
  const { tagId, modifiedBy, name } = userdata;

  const existingTag = await prisma.aps2024_tag.findUnique({
    where: { id_tag: tagId },
  });

  if (!existingTag) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'un tag inexistante.
      Informations de débogage : 
      ID du tag demandé : ${tagId}`,
    });
    throw new ErrorHandler(401, "Tag inexistante");
  }

  // Check if name is already taken
  const existingName = await prisma.aps2024_tag.findFirst({
    where: {
      id_tag: {
        not: tagId, // Exclude the current tag
      },
      name: {
        equals: name,
        mode: "insensitive", // Case-insensitive search
      },
    },
  });

  if (existingName) {
    logger.error({
      ...logData,
      message: `Une tentative de modifer un tag avec un nom ${existingName.name} déjà pris.
      Informations de débogage :
      Nom demandé : ${name}`,
    });
    throw new ErrorHandler(401, "Nom déjà pris");
  }

  await prisma.aps2024_tag.update({
    where: {
      id_tag: tagId,
    },
    data: {
      name: name,
      alias: createAlias(name),
      modified_by: modifiedBy,
      modified_date: new Date(),
    },
  });

  return existingTag.name;
};

export const deleteTag = async (tagId, logData) => {
  const existingTag = await prisma.aps2024_tag.findUnique({
    where: { id_tag: tagId },
  });

  if (!existingTag) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'un tag inexistante.
      Informations de débogage : 
      ID du tag demandé : ${tagId}`,
    });

    throw new ErrorHandler(401, "Tag inexistante");
  }

  await prisma.aps2024_tag.delete({
    where: {
      id_tag: tagId,
    },
  });

  return existingTag.name;
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
