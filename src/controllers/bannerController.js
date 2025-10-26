import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { ValidationError } from "../middlewares/errorMiddleware.js";
import {
  changeStateBanner,
  createBanner,
  getAllBanners,
  getOneBanner,
  updateBanner,
} from "../services/bannerService.js";
import { BannerPosition } from "../utils/enum.js";

import { infoLogger, createLogEntry } from "../utils/logger.js";
import { tryCatch } from "../utils/tryCatch.js";
import {
  bannerIdSchema,
  bannerSchema,
  updateBannerSchema,
} from "../validations/bannerValidation.js";

// Logger instance for logging banner-related actions
const logger = infoLogger("bannieres");

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
// Controller function to get all banners
export const GetAllBanners = tryCatch(async (req, res) => {
  // Retrieve all banners from the service
  const data = await getAllBanners(req.body);

  // Respond with success message and banner data
  return res.status(200).json({
    success: true,
    message: "Banners Successfully fetched",
    data,
    BannerPosition: BannerPosition.entries(),
  });
});

export const GetOneBanner = tryCatch(async (req, res) => {
  // Retrieve all banners from the service
  const { error } = bannerIdSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const data = await getOneBanner(req.body);

  // Respond with success message and banner data
  return res.status(200).json({
    success: true,
    message: "Banner Successfully fetched",
    data,
  });
});

// Controller function to create a new banner
export const CreateBanner = tryCatch(async (req, res) => {
  const { publish_date, publish_down, is_publish, position, categorieId } =
    req.body;

  const body = {
    ...req.body,
    ...(publish_date !== undefined && {
      publish_date: new Date(publish_date),
    }),
    ...(publish_down !== undefined && {
      publish_down: new Date(publish_down),
    }),
    ...(is_publish !== undefined && { is_publish: JSON.parse(is_publish) }),
    ...(categorieId !== undefined && { categorieId: JSON.parse(categorieId) }),
    ...(position !== undefined && { position: JSON.parse(position) }),
  };

  // Validate the request body against the schema
  const { error } = bannerSchema.validate({
    ...body,
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

  // Call the createbannere service function to create a new banner
  const data = await createBanner(
    {
      ...body,
      file: req.file,
      id_session: req.session.sessionId,
      id_user: req.session.userId,
      created_by: req.session.username,
    },
    customLog(req, { action: "creation" })
  );

  // Log banner creation
  logger.info(
    customLog(req, {
      message: `Une nouvelle bannière a été créé."`,
      action: "creation",
    })
  );

  // Respond with success message and banner data
  return res.status(201).json({
    success: true,
    message: "bannière créé avec succès.",
    data,
  });
});

// Controller function to change the state of a banner (publish/depublish)
export const ChangeStateBanner = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = bannerIdSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Change the state of the banner and retrieve its name and new state
  const { name, is_publish } = await changeStateBanner(
    {
      ...req.body,
      actionBy: req.session.username,
    },
    customLog(req)
  );

  // Log banner state change
  logger.info(
    customLog(req, {
      message: `La bannière : "${name}" a été ${
        is_publish ? "depublier" : "publier"
      } avec succés.`,
      action: `${is_publish ? "depublication" : "publication"}`,
    })
  );

  // Respond with success message
  return res.status(200).json({
    success: true,
    message: "L'état du bannière a été modifié avec succés.",
  });
});

// // Controller function to update a banner
export const UpdateBanner = tryCatch(async (req, res) => {
  const {
    publish_date,
    publish_down,
    is_publish,
    bannerId,
    position,
    categorieId,
  } = req.body;

  const body = {
    ...req.body,
    ...(bannerId !== undefined && { bannerId: JSON.parse(bannerId) }),
    ...(publish_date !== undefined && {
      publish_date: new Date(publish_date),
    }),
    ...(publish_down !== undefined && {
      publish_down: new Date(publish_down),
    }),
    ...(is_publish !== undefined && { is_publish: JSON.parse(is_publish) }),
    ...(position !== undefined && { position: JSON.parse(position) }),
    ...(categorieId !== undefined && { categorieId: JSON.parse(categorieId) }),
  };

  // Validate the request body against schema
  const { error } = updateBannerSchema.validate(body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const logMessage = await updateBanner(
    {
      ...body,
      file: req.file,
      modifiedBy: req.session.username,
      id_session: req.session.sessionId,
      id_user: req.session.userId,
      created_by: req.session.username,
    },
    customLog(req, { action: "modification" })
  );

  logger.info(
    customLog(req, {
      message: logMessage,
      action: "modification",
    })
  );

  return res.status(201).json({
    success: true,
    message: "La bannière modifié avec succès.",
  });
});
