import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { ValidationError } from "../middlewares/errorMiddleware.js";
import {
  getAllEmergencybands,
  changeStateEmergencyband,
  createEmergencyband,
  getOneEmergencyband,
  updateEmergencyband,
} from "../services/emergencyBandService.js";

import { infoLogger, createLogEntry } from "../utils/logger.js";
import { tryCatch } from "../utils/tryCatch.js";
import {
  emergencybandIdSchema,
  emergencyBandSchema,
  updateBannerSchema,
} from "../validations/emergencyBandValidation.js";

// Logger instance for logging banner-related actions
const logger = infoLogger("urgence");

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
// Controller function to get all emergencyBand
export const GetAllEmergencybands = tryCatch(async (req, res) => {
  // Retrieve all emergencyBand from the service
  const data = await getAllEmergencybands(req.body);

  // Respond with success message and banner data
  return res.status(200).json({
    success: true,
    message: "Emergency Bands Successfully fetched",
    data,
  });
});

export const GetOneEmergencyband = tryCatch(async (req, res) => {
  // Retrieve all emergencyBand from the service
  const { error } = emergencybandIdSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const data = await getOneEmergencyband(req.body);

  // Respond with success message and banner data
  return res.status(200).json({
    success: true,
    message: "Emergencyband Successfully fetched",
    data,
  });
});

// Controller function to create a new banner
export const CreateEmergencyband = tryCatch(async (req, res) => {
  // Validate the request body against the schema
  const { error } = emergencyBandSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the createbannere service function to create a new banner
  const data = await createEmergencyband(
    {
      ...req.body,
      id_session: req.session.sessionId,
      id_user: req.session.userId,
      created_by: req.session.username,
    },
    customLog(req, { action: "creation" })
  );

  // Log banner creation
  logger.info(
    customLog(req, {
      message: `Une nouvelle bande d'alerte a été créé."`,
      action: "creation",
    })
  );

  // Respond with success message and banner data
  return res.status(201).json({
    success: true,
    message: "bande d'alerte créé avec succès.",
    data,
  });
});

// Controller function to change the state of a banner (publish/depublish)
export const ChangeStateEmergencyband = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = emergencybandIdSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Change the state of the banner and retrieve its title and new state
  const { title, is_publish } = await changeStateEmergencyband(
    {
      ...req.body,
      actionBy: req.session.username,
    },
    customLog(req)
  );

  // Log banner state change
  logger.info(
    customLog(req, {
      message: `La bande d'alerte : "${title}" a été ${
        is_publish ? "depublier" : "publier"
      } avec succés.`,
      action: `${is_publish ? "depublication" : "publication"}`,
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "L'état du bande d'alerte a été modifié avec succés.",
  });
});

// // Controller function to update a banner
export const UpdateEmergencyband = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = updateBannerSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the banner and retrieve its title

  const logMessage = await updateEmergencyband(
    {
      ...req.body,
      modifiedBy: req.session.username,
      id_session: 1700,
    },
    customLog(req, { action: "modification" })
  );

  // Update the banner and retrieve its title
  logger.info(
    customLog(req, {
      message: logMessage,
      action: "modification",
    })
  );

  // Respond with success message
  return res.status(200).json({
    success: true,
    message: "La bande d'alerte modifié avec succès.",
  });
});
