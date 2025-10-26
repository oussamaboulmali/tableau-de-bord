import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { ValidationError } from "../middlewares/errorMiddleware.js";
import {
  changeStateInfographie,
  createInfographie,
  getAllInfographie,
  getAllInfographieWithPaginations,
  getOneInfographie,
  searchInfographie,
  updateInfographie,
} from "../services/infographieService.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";
import { tryCatch } from "../utils/tryCatch.js";
import {
  getInfographieschema,
  infographieIdSchema,
  infographieSchema,
  searchInfographieSchema,
  updateInfographieSchema,
} from "../validations/infographieValidation.js";

// Logger instance for logging infographie-related actions
const logger = infoLogger("infographies");

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
// Controller function to get all infographies
export const GetAllInfographie = tryCatch(async (req, res) => {
  // Retrieve all infographies from the service
  const data = await getAllInfographie(req.body);

  // Respond with success message and infographie data
  return res.status(200).json({
    success: true,
    message: "Infographies Successfully fetched",
    data,
  });
});

// Controller function to get all infographies
export const GetAllInfographieWithPaginations = tryCatch(async (req, res) => {
  const { error } = getInfographieschema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  // Retrieve all infographies from the service
  const { infographies: data, count } = await getAllInfographieWithPaginations(
    req.body
  );

  // Respond with success message and tag data
  return res.status(200).json({
    success: true,
    message: "Infographies Successfully fetched",
    count,
    data,
  });
});

export const SearchInfographie = tryCatch(async (req, res) => {
  const { error } = searchInfographieSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  // Retrieve all infographies from the service
  const { infographies: data, count } = await searchInfographie(req.body);

  // Respond with success message and tag data
  return res.status(200).json({
    success: true,
    message: "Infographies Successfully fetched",
    count,
    data,
  });
});

export const GetOneInfographie = tryCatch(async (req, res) => {
  // Retrieve all infographies from the service
  const { error } = infographieIdSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const data = await getOneInfographie(req.body);

  // Respond with success message and infographie data
  return res.status(200).json({
    success: true,
    message: "Infographie Successfully fetched",
    data,
  });
});

// Controller function to create a new infographie
export const CreateInfographie = tryCatch(async (req, res) => {
  // Validate the request body against the schema
  const { error } = infographieSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the createinfographiee service function to create a new infographie
  const data = await createInfographie(
    {
      ...req.body,
      file: req.file,
      id_session: req.session.sessionId,
      id_user: req.session.userId,
      created_by: req.session.username,
    },
    customLog(req, { action: "creation" })
  );

  // Log infographie creation
  logger.info(
    customLog(req, {
      message: `Une nouvelle Infographie a été créé."`,
      action: "creation",
    })
  );

  // Respond with success message and infographie data
  return res.status(201).json({
    success: true,
    message: "Infographie créé avec succès.",
    data,
  });
});

// Controller function to update a infographie
export const UpdateInfographie = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = updateInfographieSchema.validate({
    ...req.body,
    infographieId: JSON.parse(req.body.infographieId),
  });

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the infographie and retrieve its name

  const logMessage = await updateInfographie(
    {
      ...req.body,
      infographieId: JSON.parse(req.body.infographieId),
      file: req.file,
      modifiedBy: req.session.username,
      id_session: req.session.sessionId,
      id_user: req.session.userId, // if new image uploded for when updating dossier image
      created_by: req.session.username, // if new image uploded for when updating dossier image
    },
    customLog(req, { action: "modification" })
  );

  // Update the infographie and retrieve its name
  logger.info(
    customLog(req, {
      message: logMessage,
      action: "modification",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "La Infographie modifié avec succès.",
  });
});

// Controller function to change the state of a infographie (publish/depublish)
export const ChangeStateInfographie = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = infographieIdSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Change the state of the infographie and retrieve its name and new state
  const { name, is_publish } = await changeStateInfographie(
    {
      ...req.body,
      actionBy: req.session.username,
    },
    customLog(req)
  );

  // Log infographie state change
  logger.info(
    customLog(req, {
      message: `L'infographie : "${name}" a été ${
        is_publish ? "depublier" : "publier"
      } avec succés.`,
      action: `${is_publish ? "depublication" : "publication"}`,
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "L'état du infographie a été modifié avec succés.",
  });
});
