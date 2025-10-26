import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { ValidationError } from "../middlewares/errorMiddleware.js";
import {
  changeStateGallery,
  createGallery,
  getAllGallery,
  getAllGalleryWithPaginations,
  getHomePageGalleries,
  getOneGallery,
  getOtherGalleriesPublished,
  getPinnedGallery,
  pinGallery,
  searchGallery,
  searchOtherGalleriesPublished,
  updateGallery,
} from "../services/galleryService.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";
import { tryCatch } from "../utils/tryCatch.js";
import {
  galleryIdSchema,
  gallerySchema,
  getGalleryPubishedSchema,
  getGalleryschema,
  pinGallerySchema,
  searchGalleryPubishedSchema,
  searchGallerySchema,
  updateGallerySchema,
} from "../validations/galleryValidation.js";

// Logger instance for logging galerie-related actions
const logger = infoLogger("galeries");

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
// Controller function to get all galleries
export const GetAllGallery = tryCatch(async (req, res) => {
  // Retrieve all galleries from the service
  const data = await getAllGallery();

  // Respond with success message and galerie data
  return res.status(200).json({
    success: true,
    message: "Galleries Successfully fetched",
    data,
  });
});

// Controller function to get all pinned galleries
export const GetPinnedGallery = tryCatch(async (req, res) => {
  // Retrieve all galleries from the service
  const data = await getPinnedGallery();

  // Respond with success message and galerie data
  return res.status(200).json({
    success: true,
    message: "Pinned Galleries Successfully fetched",
    data,
  });
});

export const GetHomePageGalleries = tryCatch(async (req, res) => {
  // Retrieve all galleries from the service
  const data = await getHomePageGalleries();

  // Respond with success message and galerie data
  return res.status(200).json({
    success: true,
    message: "Home Page Galleries Successfully fetched",
    data,
  });
});

// Controller function to get all galleries
export const GetAllGalleriesWithPaginations = tryCatch(async (req, res) => {
  const { error } = getGalleryschema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  // Retrieve all galleries from the service
  const { homeGalleries: data, count } = await getAllGalleryWithPaginations(
    req.body
  );

  // Respond with success message and tag data
  return res.status(200).json({
    success: true,
    message: "Galleries Successfully fetched",
    count,
    data,
  });
});

export const GetOtherGalleriesPublished = tryCatch(async (req, res) => {
  const { error } = getGalleryPubishedSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const { homeGalleries: data, count } = await getOtherGalleriesPublished(
    req.body
  );

  return res.status(200).json({
    success: true,
    message: "Galleries Successfully fetched",
    count,
    data,
  });
});

export const SearchGallery = tryCatch(async (req, res) => {
  const { error } = searchGallerySchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  // Retrieve all galleries from the service
  const { homeGalleries: data, count } = await searchGallery(req.body);

  // Respond with success message and tag data
  return res.status(200).json({
    success: true,
    message: "Galleries Successfully fetched",
    count,
    data,
  });
});

export const SearchOtherGalleriesPublished = tryCatch(async (req, res) => {
  // Retrieve all galleries from the service
  const { error } = searchGalleryPubishedSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const { homeGalleries: data, count } = await searchOtherGalleriesPublished(
    req.body
  );

  // Respond with success message and image data
  return res.status(200).json({
    success: true,
    message: "Galleries Successfully fetched",
    count,
    data,
  });
});

export const GetOneGallery = tryCatch(async (req, res) => {
  // Retrieve all galleries from the service
  const { error } = galleryIdSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const data = await getOneGallery(req.body);

  // Respond with success message and galerie data
  return res.status(200).json({
    success: true,
    message: "Galerie Successfully fetched",
    data,
  });
});

// Controller function to create a new galerie
export const CreateGallery = tryCatch(async (req, res) => {
  const { position, is_watermarked } = req.body;

  const body = {
    ...req.body,
    ...(position !== undefined && { position: JSON.parse(position) }),
    ...(is_watermarked !== undefined && {
      is_watermarked: JSON.parse(is_watermarked),
    }),
  };

  // Validate the request body against the schema
  const { error } = gallerySchema.validate(body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the createvideoe service function to create a new galerie
  const data = await createGallery(
    {
      ...body,
      files: req.files,
      id_session: req.session.sessionId,
      id_user: req.session.userId,
      created_by: req.session.username,
    },
    customLog(req, { action: "creation" })
  );

  // Log galerie creation
  logger.info(
    customLog(req, {
      message: `Une nouvelle Galerie a été créé avec le titre : ${data.name}"`,
      action: "creation",
    })
  );

  // Respond with success message and galerie data
  return res.status(201).json({
    success: true,
    message: "Galerie créé avec succès.",
    data,
  });
});

// Controller function to update a galerie
export const UpdateGallery = tryCatch(async (req, res) => {
  const { galleryId, featuredImageId, imagesId } = req.body;
  const body = {
    ...req.body,
    galleryId: JSON.parse(galleryId),
    ...(featuredImageId !== undefined && {
      featuredImageId: JSON.parse(featuredImageId),
    }),
    ...(imagesId !== undefined && {
      imagesId: JSON.parse(imagesId),
    }),
  };

  // Validate the request body against schema
  const { error } = updateGallerySchema.validate(body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the galerie and retrieve its name

  const { name: videoName, image: data } = await updateGallery(
    {
      ...body,
      files: req.files,
      modifiedBy: req.session.username,
      id_session: req.session.sessionId,
      id_user: req.session.userId, // if new image uploded for when updating dossier image
      created_by: req.session.username, // if new image uploded for when updating dossier image
    },
    customLog(req, { action: "modification" })
  );

  // Update the galerie and retrieve its name
  logger.info(
    customLog(req, {
      message: `la Galerie "${videoName}" a été modifiée avec succés.`,
      action: "modification",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "La Galerie a été modifié avec succès.",
    data,
  });
});

// Controller function to change the state of a galerie (publish/depublish)
export const ChangeStateGallery = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = galleryIdSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Change the state of the galerie and retrieve its name and new state
  const { name, is_publish } = await changeStateGallery(
    {
      ...req.body,
      actionBy: req.session.username,
    },
    customLog(req)
  );

  // Log galerie state change
  logger.info(
    customLog(req, {
      message: `La galerie : "${name}" a été ${
        is_publish ? "depublier" : "publier"
      } avec succés.`,
      action: `${is_publish ? "depublication" : "publication"}`,
    })
  );

  // Respond with success message
  return res.status(200).json({
    success: true,
    message: "L'état du galerie a été modifié avec succés.",
  });
});

export const PinGallery = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = pinGallerySchema.validate(req.body);

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
  const name = await pinGallery(
    {
      ...req.body,
      modified_by: req.session.username,
    },
    customLog(req, { action: "pinning/unpinning" })
  );

  // Update the article and retrieve its name
  logger.info(
    customLog(req, {
      message: `la galerie "${name}" a été  ${
        req.body.is_pinned ? "épinglé" : "dépinglé"
      }  avec succés.`,
      action: "pinning/unpinning",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: `La Galerie a été ${
      req.body.is_pinned ? "épinglé" : "dépinglé"
    } avec succès.`,
  });
});
