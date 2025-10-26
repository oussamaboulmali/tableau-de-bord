/**
 * @fileoverview Article Controller
 * 
 * Manages all article-related operations including:
 * - CRUD operations (Create, Read, Update, Delete articles)
 * - Article workflow (draft → validation → publication)
 * - Article search and filtering with pagination
 * - Article blocks and pinning for homepage layout
 * - Article locking mechanism for concurrent editing prevention
 * - Multi-language article support
 * 
 * Articles go through an editorial workflow:
 * 1. Draft - Created by Rédacteur
 * 2. Validation - Validated by Chef de vacation
 * 3. Published - Published by Rédacteur en chef
 * 
 * @module controllers/articleController
 * @requires ../middlewares/errorMiddleware
 * @requires ../services/articleService
 * @requires ../utils/logger
 * @requires ../utils/tryCatch
 * @requires ../validations/articleValidation
 */

import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { ValidationError } from "../middlewares/errorMiddleware.js";
import {
  createArticle,
  getAllArticles,
  getOneArticle,
  getArticleByUrl,
  searchArticles,
  getLanguages,
  updateArticle,
  publishArticle,
  unPublishArticle,
  sendArticleToTrash,
  getBlocksWithPosition,
  fetchArticlesForBlock,
  pinArticle,
  getOtherArticlesPublished,
  searchOtherPublishedArticles,
  toggleArticleLock,
} from "../services/articleService.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";
import { tryCatch } from "../utils/tryCatch.js";
import {
  articleGetBlocksSchema,
  articleIdSchema,
  articlePublishSchema,
  articleSchema,
  articleUrlSchema,
  fetchaArticleHomeBlocksSchema,
  getArticlePubishedSchema,
  getArticleSchema,
  pinArticleSchema,
  searchArticlePubishedSchema,
  searchSchema,
  updateArticleSchema,
} from "../validations/articleValidation.js";

// Logger instance for logging article-related actions
const logger = infoLogger("articles");

/**
 * Creates a custom log entry with request context for article actions
 * 
 * @param {Object} req - Express request object
 * @param {Object} options - Additional logging options
 * @param {string} [options.message] - Custom log message
 * @param {string} [options.action] - Action being logged
 * @param {Error} [options.err] - Error object if applicable
 * @returns {Object} Enhanced log entry with custom fields
 */
const customLog = (req, options = {}) => {
  const { message, action, err } = options;

  // Get base log entry from createLogEntry
  const baseLogEntry = createLogEntry(req, err);

  // Add custom fields
  return {
    ...baseLogEntry,
    action: action || null,
    username: req.session?.username || null,
    ...(message && { message }),
  };
};
export const GetAllArticles = tryCatch(async (req, res) => {
  const { error } = getArticleSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const { articles: data, count } = await getAllArticles(req.body);

  return res.status(200).json({
    success: true,
    message: "Articles Successfully fetched",
    count,
    data,
  });
});

export const GetOtherArticlesPublished = tryCatch(async (req, res) => {
  const { error } = getArticlePubishedSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const { articles: data, count } = await getOtherArticlesPublished(req.body);

  return res.status(200).json({
    success: true,
    message: "Articles Successfully fetched",
    count,
    data,
  });
});

export const GetLanguages = tryCatch(async (req, res) => {
  const data = await getLanguages();

  return res.status(200).json({
    success: true,
    message: "Lang Successfully fetched",
    data,
  });
});

export const GetOneArticle = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = articleIdSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const data = await getOneArticle(req.body);

  return res.status(200).json({
    success: true,
    message: "Article Successfully fetched",
    data,
  });
});

export const GetBlocksWithPosition = tryCatch(async (req, res) => {
  const { blocks: data } = await getBlocksWithPosition(req.body);

  return res.status(200).json({
    success: true,
    message: "Blocks Successfully fetched",
    data,
  });
});

export const FetchArticlesForBlock = tryCatch(async (req, res) => {
  const { error } = fetchaArticleHomeBlocksSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const data = await fetchArticlesForBlock(req.body);

  return res.status(200).json({
    success: true,
    message: "Blocks Successfully fetched",
    data,
  });
});

export const GetReadMoreArticle = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = articleUrlSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const data = await getArticleByUrl(req.body);

  return res.status(200).json({
    success: true,
    message: "Article Successfully fetched",
    data,
  });
});

// Controller function to get all articles
export const SearchArticles = tryCatch(async (req, res) => {
  // Retrieve all articles from the service
  const { error } = searchSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const { articles: data, count } = await searchArticles(req.body);

  // Respond with success message and image data
  return res.status(200).json({
    success: true,
    message: "Articles Successfully fetched",
    count,
    data,
  });
});

export const SearchOtherPublishedArticles = tryCatch(async (req, res) => {
  // Retrieve all articles from the service
  const { error } = searchArticlePubishedSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const { articles: data, count } = await searchOtherPublishedArticles(
    req.body
  );

  // Respond with success message and image data
  return res.status(200).json({
    success: true,
    message: "Articles Successfully fetched",
    count,
    data,
  });
});

export const CreateArticle = tryCatch(async (req, res) => {
  console.log(req.body);
  // Validate the request body
  const { error } = articleSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the create article service function to create a new article
  const data = await createArticle(
    {
      ...req.body,
      id_session: req.session.sessionId,
      id_user: req.session.userId,
      created_by: req.session.username,
    },
    customLog(req, { action: "creation" })
  );

  // Log category creation
  logger.info(
    customLog(req, {
      message: ` created the following Article: "${req.body.title}"`,
      action: "creation",
    })
  );

  return res.status(201).json({
    success: true,
    message: "Un article a été creé avec succès.",
    data,
  });
});

export const UpdateArticle = tryCatch(async (req, res) => {
  console.log(req.body);
  // Validate the request body against schema
  const { error } = updateArticleSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the article and retrieve its name
  const messageLog = await updateArticle(
    {
      ...req.body,
      modified_by: req.session.username,
    },
    customLog(req, { action: "modification" })
  );

  // Update the article and retrieve its name
  logger.info(
    customLog(req, {
      message: messageLog,
      action: "modification",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "Un article a été modifié avec succès.",
  });
});

export const PinArticle = tryCatch(async (req, res) => {
  console.log(req.body);

  // Validate the request body against schema
  const { error } = pinArticleSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the article and retrieve its name
  const { title, articles: data } = await pinArticle(
    {
      ...req.body,
      modified_by: req.session.username,
    },
    customLog(req, { action: "pinning/unpinning" })
  );

  // Update the article and retrieve its name
  logger.info(
    customLog(req, {
      message: `l'article "${title}" a été  ${
        req.body.is_pinned ? "épinglé" : "dépinglé"
      }  avec succés.`,
      action: "pinning/unpinning",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "Un article a été modifié avec succès.",
    data,
  });
});

export const PublishArticle = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = articlePublishSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the article and retrieve its name
  const title = await publishArticle(
    {
      ...req.body,
      publish_by: req.session.username,
    },
    req.user,
    customLog(req, { action: "publication" })
  );

  // Update the article and retrieve its name
  logger.info(
    customLog(req, {
      message: `l'article "${title}" a été publié avec succés.`,
      action: "publication",
    })
  );

  // Respond with success message
  return res.status(200).json({
    success: true,
    message: "L'article a été publié avec succès.",
  });
});

export const UnPublishArticle = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = articleIdSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the article and retrieve its name
  const title = await unPublishArticle(
    {
      ...req.body,
      unPublish_by: req.session.username,
    },
    customLog(req, { action: "depublication" })
  );

  // Update the article and retrieve its name
  logger.info(
    customLog(req, {
      message: `l'article "${title}" a été dépublié avec succés.`,
      action: "depublication",
    })
  );

  // Respond with success message
  return res.status(200).json({
    success: true,
    message: "L'article a été dépublié avec succès.",
  });
});

export const SendArticleToTrash = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = articleIdSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the article and retrieve its name
  const title = await sendArticleToTrash(
    {
      ...req.body,
      unPublish_by: req.session.username,
    },
    customLog(req, { action: "depublication" })
  );

  // Update the article and retrieve its name
  logger.info(
    customLog(req, {
      message: `l'article "${title}" a été envoyé à la corbeille avec succés.`,
      action: "publication",
    })
  );

  // Respond with success message
  return res.status(200).json({
    success: true,
    message: "L'article a été envoyé à la corbeille avec succès.",
  });
});

export const ToggleArticleLock = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = articleIdSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the article and retrieve its name
  const articleName = await toggleArticleLock(
    {
      ...req.body,
      locked_by: req.session.username,
    },
    customLog(req, { action: "verrouillage/déverrouillage" })
  );

  // Update the article and retrieve its name
  logger.info(
    customLog(req, {
      message: `l'article "${articleName}" a été verrouillé/déverrouillé avec succès.`,
      action: "verrouillage/déverrouillage",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "L'article a été verrouillé/déverrouillé avec succès.",
  });
});
