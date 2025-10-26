import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { ValidationError } from "../middlewares/errorMiddleware.js";
import {
  addAritclesToDossier,
  changeStateDossier,
  createDossier,
  getAllDossier,
  getOneDossier,
  getOtherArticlesOfDossier,
  removeArticleFromDossier,
  searchOtherArticlesOfDossier,
  updateDossier,
} from "../services/dossierService.js";

import { infoLogger, createLogEntry } from "../utils/logger.js";
import { tryCatch } from "../utils/tryCatch.js";
import {
  dossierArticlesRemoveSchema,
  dossierArticlesSchema,
  dossierIdSchema,
  dossierSchema,
  otherArticlesOfDossierSchema,
  searchOtherArticlesOfDossierSchema,
  updateDossierSchema,
} from "../validations/dossierValidation.js";

// Logger instance for logging dossier-related actions
const logger = infoLogger("dossiers");

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
// Controller function to get all dossiers
export const GetAllDossier = tryCatch(async (req, res) => {
  // Retrieve all dossiers from the service
  const data = await getAllDossier();

  // Respond with success message and dossier data
  return res.status(200).json({
    success: true,
    message: "Dossier Successfully fetched",
    data,
  });
});

export const GetOneDossier = tryCatch(async (req, res) => {
  // Retrieve all dossiers from the service
  const { error } = dossierIdSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const data = await getOneDossier(req.body);

  // Respond with success message and dossier data
  return res.status(200).json({
    success: true,
    message: "Dossier Successfully fetched",
    data,
  });
});

// Controller function to create a new dossier
export const CreateDossier = tryCatch(async (req, res) => {
  const { articles } = req.body;
  const body = {
    ...req.body,
    ...(articles !== undefined && {
      articles: JSON.parse(articles),
    }),
  };

  // Validate the request body against the schema
  const { error } = dossierSchema.validate(body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the createdossiere service function to create a new dossier
  const data = await createDossier(
    {
      ...body,
      file: req.file,
      id_session: req.session.sessionId,
      id_user: req.session.userId,
      created_by: req.session.username,
    },
    customLog(req, { action: "creation" })
  );

  // Log dossier creation
  logger.info(
    customLog(req, {
      message: `Un nouveau dossier "${req.body.name}" a été créé."`,
      action: "creation",
    })
  );

  // Respond with success message and dossier data
  return res.status(201).json({
    success: true,
    message: "Dossier créé avec succès.",
    data,
  });
});

// Controller function to change the state of a dossier (publish/depublish)
export const ChangeStateDossier = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = dossierIdSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Change the state of the dossier and retrieve its name and new state
  const { name, is_publish } = await changeStateDossier(
    {
      ...req.body,
      actionBy: req.session.username,
    },
    customLog(req)
  );

  // Log dossier state change
  logger.info(
    customLog(req, {
      message: `Le dossier : "${name}" a été ${
        is_publish ? "depublier" : "publier"
      } avec succés.`,
      action: `${is_publish ? "depublication" : "publication"}`,
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "L'état du dossier a été modifié avec succés.",
  });
});

// Controller function to update a dossier
export const UpdateDossier = tryCatch(async (req, res) => {
  const body = {
    ...req.body,
    dossierId: JSON.parse(req.body.dossierId),
  };
  // Validate the request body against schema
  const { error } = updateDossierSchema.validate(body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the dossier and retrieve its name
  const logMessage = await updateDossier(
    {
      ...body,
      file: req.file,
      modifiedBy: req.session.username,
      id_session: req.session.sessionId,
      id_user: req.session.userId, // if new image uploded for when updating dossier image
      created_by: req.session.username, // if new image uploded for when updating dossier image
    },
    customLog(req, { action: "modification" })
  );

  // Update the dossier and retrieve its name
  logger.info(
    customLog(req, {
      message: logMessage,
      action: "modification",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "Le dossier a été modifié avec succès.",
  });
});

export const AddAritclesToDossier = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = dossierArticlesSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const { dossierName, articlesTitles } = await addAritclesToDossier(
    req.body,
    customLog(req, { action: "attribuer articles/dossier" })
  );

  logger.info(
    customLog(req, {
      message: `Les articles "${articlesTitles.map(
        (title) => title
      )}" ont été attribués au dossier "${dossierName}" avec succés.`,
      action: "attribuer articles/dossier",
    })
  );

  return res.status(200).json({
    success: true,
    message: "Article ajouté au dossier avec succès",
  });
});

export const RemoveArticleFromDossier = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = dossierArticlesRemoveSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const { dossierName, articlesTitle } = await removeArticleFromDossier(
    req.body,
    customLog(req, { action: "retirer articles/dossier" })
  );

  logger.info(
    customLog(req, {
      message: `L'article "${articlesTitle}" a été retiré du dossier "${dossierName}" avec succés.`,
      action: "retirer articles/dossier",
    })
  );

  return res.status(200).json({
    success: true,
    message: "Un article a été retiré du dossier avec succés.",
  });
});

export const GetOtherArticlesOfDossier = tryCatch(async (req, res) => {
  const { error } = otherArticlesOfDossierSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const { articles: data, count } = await getOtherArticlesOfDossier(req.body);

  return res.status(200).json({
    success: true,
    message: "Articles Successfully fetched",
    count,
    data,
  });
});

// Controller function to get all articles
export const SearchOtherArticlesOfDossier = tryCatch(async (req, res) => {
  // Retrieve all articles from the service
  const { error } = searchOtherArticlesOfDossierSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const { articles: data, count } = await searchOtherArticlesOfDossier(
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
