import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { ValidationError } from "../middlewares/errorMiddleware.js";
import {
  createTag,
  deleteTag,
  getAllTags,
  getAllTagsWithPaginations,
  getArticlesOfTag,
  searchTag,
  updateTag,
} from "../services/tagService.js";

import { infoLogger, createLogEntry } from "../utils/logger.js";
import { tryCatch } from "../utils/tryCatch.js";
import {
  getTagOfArticleSchema,
  getTagsSchema,
  searchSchema,
  tagIdSchema,
  tagSchema,
  updateTagSchema,
} from "../validations/tagValidation.js";

// Logger instance for logging tag-related actions
const logger = infoLogger("tags");

// Custom log function to format log messages with request details and action
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
// Controller function to get all tags
export const GetAllTagsWithPaginations = tryCatch(async (req, res) => {
  const { error } = getTagsSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  // Retrieve all tags from the service
  const { tags: data, count } = await getAllTagsWithPaginations(req.body);

  // Respond with success message and tag data
  return res.status(200).json({
    success: true,
    message: "Tags Successfully fetched",
    count,
    data,
  });
});

export const GetAllTags = tryCatch(async (req, res) => {
  // Retrieve all images from the service
  const { error } = getTagOfArticleSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  // Retrieve all tags from the service
  const data = await getAllTags(req.body);

  // Respond with success message and tag data
  return res.status(200).json({
    success: true,
    message: "Tags Successfully fetched",
    data,
  });
});

export const SearchTags = tryCatch(async (req, res) => {
  // Retrieve all images from the service
  const { error } = searchSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const { tags: data, count } = await searchTag(req.body);

  // Respond with success message and image data
  return res.status(200).json({
    success: true,
    message: "Tags Successfully fetched",
    count,
    data,
  });
});

// Controller function to get all tags
export const GetArticlesOfTag = tryCatch(async (req, res) => {
  // Validate the request body against the schema
  const { error } = tagIdSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  // Retrieve all tags from the service
  const data = await getArticlesOfTag(req.body);

  // Respond with success message and tag data
  return res.status(200).json({
    success: true,
    message: "Articles of tag Successfully fetched",
    data,
  });
});

// Controller function to create a new tag
export const CreateTag = tryCatch(async (req, res) => {
  // Validate the request body against the schema
  const { error } = tagSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the createCategorie service function to create a new tag
  const data = await createTag(
    {
      ...req.body,
      id_session: req.session.sessionId,
      id_user: req.session.userId,
      created_by: req.session.username,
    },
    customLog(req, { action: "creation" })
  );

  // Log tag creation
  logger.info(
    customLog(req, {
      message: `Un nouveau tag "${req.body.name}" a été créé."`,
      action: "creation",
    })
  );

  // Respond with success message and tag data
  return res.status(201).json({
    success: true,
    message: "Un tag créé avec succès.",
    data,
  });
});

// Controller function to update a tag
export const UpdateTag = tryCatch(async (req, res) => {
  // Validate the request body against the schema
  const { error } = updateTagSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the tag and retrieve its name
  const tagName = await updateTag(
    {
      ...req.body,
      modifiedBy: req.session.username,
    },
    customLog(req, { action: "modification" })
  );

  // Log tag update
  logger.info(
    customLog(req, {
      message: `le tag : "${tagName}" a été modifié avec succés en ${req.body.name}`,
      action: "modification",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "Un tag modifié avec succès.",
  });
});

// Controller function to delete a tag
export const DeleteTag = tryCatch(async (req, res) => {
  // Validate the request body against the schema
  const { error } = tagIdSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Delete the tag and retrieve its name
  const tagName = await deleteTag(
    req.body.tagId,
    customLog(req, { action: "suppression" })
  );

  logger.info(
    customLog(req, {
      message: `Le tag "${tagName}" a été supprimé.`,
      action: "suppression",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "Un tag supprimé avec succès.",
  });
});
