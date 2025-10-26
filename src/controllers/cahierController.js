import { ValidationError } from "../middlewares/errorMiddleware.js";
import {
  changeStateCahier,
  createMultiCahier,
  getAllCahier,
  getAllCahierWithPaginations,
  getOneCahier,
  searchCahier,
  updateCahier,
} from "../services/cahierService.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";
import { tryCatch } from "../utils/tryCatch.js";
import {
  cahierIdSchema,
  cahierSchema,
  getCahierschema,
  searchCahierSchema,
  updateCahierSchema,
} from "../validations/cahierValidation.js";

// Logger instance for logging cahier-related actions
const logger = infoLogger("cahiers");

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
// Controller function to get all cahiers
export const GetAllCahier = tryCatch(async (req, res) => {
  // Retrieve all cahiers from the service
  const data = await getAllCahier(req.body);

  // Respond with success message and cahier data
  return res.status(200).json({
    success: true,
    message: "Cahiers Successfully fetched",
    data,
  });
});

// Controller function to get all cahiers
export const GetAllCahierWithPaginations = tryCatch(async (req, res) => {
  const { error } = getCahierschema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  // Retrieve all cahiers from the service
  const { cahiers: data, count } = await getAllCahierWithPaginations(req.body);

  // Respond with success message and tag data
  return res.status(200).json({
    success: true,
    message: "Cahiers Successfully fetched",
    count,
    data,
  });
});

export const SearchCahier = tryCatch(async (req, res) => {
  const { error } = searchCahierSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  // Retrieve all cahier from the service
  const { cahiers: data, count } = await searchCahier(req.body);

  // Respond with success message and tag data
  return res.status(200).json({
    success: true,
    message: "Cahiers Successfully fetched",
    count,
    data,
  });
});

export const GetOneCahier = tryCatch(async (req, res) => {
  // Retrieve all cahiers from the service
  const { error } = cahierIdSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const data = await getOneCahier(req.body);

  // Respond with success message and cahier data
  return res.status(200).json({
    success: true,
    message: "Cahier Successfully fetched",
    data,
  });
});

// Controller function to create a new cahier
export const CreateCahier = tryCatch(async (req, res) => {
  // Validate the request body against the schema
  const { error } = cahierSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the createcahiere service function to create a new cahier
  const data = await createMultiCahier(
    {
      ...req.body,
      files: req.files,
      id_session: req.session.sessionId,
      id_user: req.session.userId,
      created_by: req.session.username,
    },
    customLog(req, { action: "creation" })
  );

  // Log cahier creation
  logger.info(
    customLog(req, {
      message: `Un nouveau Cahier a été créé."`,
      action: "creation",
    })
  );

  // Respond with success message and cahier data
  return res.status(201).json({
    success: true,
    message: "Cahier créé avec succès.",
    data,
  });
});

// Controller function to update a cahier
export const UpdateCahier = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = updateCahierSchema.validate({
    ...req.body,
    cahierId: JSON.parse(req.body.cahierId),
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

  // Update the cahier and retrieve its name

  const logMessage = await updateCahier(
    {
      ...req.body,
      cahierId: JSON.parse(req.body.cahierId),
      files: req.files,
      modifiedBy: req.session.username,
      id_session: req.session.sessionId,
      id_user: req.session.userId, // if new image uploded for when updating dossier image
      created_by: req.session.username, // if new image uploded for when updating dossier image
    },
    customLog(req, { action: "modification" })
  );

  // Update the cahier and retrieve its name
  logger.info(
    customLog(req, {
      message: logMessage,
      action: "modification",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "Le cahier modifié avec succès.",
  });
});

// Controller function to change the state of a cahier (publish/depublish)
export const ChangeStateCahier = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = cahierIdSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Change the state of the cahier and retrieve its name and new state
  const { name, is_publish } = await changeStateCahier(
    {
      ...req.body,
      actionBy: req.session.username,
    },
    customLog(req)
  );

  // Log cahier state change
  logger.info(
    customLog(req, {
      message: `Le cahier : "${name}" a été ${
        is_publish ? "depublier" : "publier"
      } avec succés.`,
      action: `${is_publish ? "depublication" : "publication"}`,
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "L'état du cahier a été modifié avec succés.",
  });
});
