import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { ValidationError } from "../middlewares/errorMiddleware.js";
import {
  deleteGallery,
  getAllGalleries,
  getAllGalleriesHaveNoArticles,
  getOneGallery,
  getOtherImagesOfGallery,
  searchGalleries,
  updateGallery,
  uploadGallery,
} from "../services/galleryArticleService.js";

import { infoLogger, createLogEntry } from "../utils/logger.js";
import { tryCatch } from "../utils/tryCatch.js";
import {
  galleryIdDeleteSchema,
  galleryIdSchema,
  gallerySchema,
  getGallerysSchema,
  searchSchema,
  updateGallerySchema,
} from "../validations/galleryArticlesValidation.js";

// Logger instance for logging image-related actions
const logger = infoLogger("galerie_articles");

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

// Controller function to update a gallery
export const UpdateGallery = tryCatch(async (req, res) => {
  // Validate the request body against the schema
  const { error } = updateGallerySchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the gallery and retrieve its name
  const {
    galleryName,
    addedImages,
    removedImages: removedImageIds,
  } = await updateGallery(
    {
      ...req.body,
      id_session: req.session.sessionId,
      id_user: req.session.userId,
      modified_by: req.session.username,
    },
    customLog(req, { action: "modification" })
  );

  // Log gallery update
  logger.info(
    customLog(req, {
      message: `La galerie "${galleryName}" a été modifié avec succés.`,
      action: "modification",
    })
  );

  if (addedImages) {
    logger.info(
      customLog(req, {
        message: `Les images suivants ${addedImages.map(
          (image) => image.id_image
        )} ont été attribués à La galerie "${galleryName}" avec succès.`,
        action: "attribuer image/galerie",
      })
    );
  }

  if (removedImageIds) {
    logger.info(
      customLog(req, {
        message: `Les images suivants ${removedImageIds.map(
          (image) => image
        )} ont été supprimé de La galerie "${galleryName}" avec succés.`,
        action: "retirer image/galerie",
      })
    );
  }

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "La galerie a été modifié avec succés.",
  });
});

export const UploadGallery = tryCatch(async (req, res) => {
  const { images, type } = req.body;

  const body = {
    ...req.body,
    ...(images !== undefined && { images: JSON.parse(images) }),
    type: JSON.parse(type),
  };

  //Validate the request body against the schema
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

  // Call the uploadGallery service function to create a new gallery
  const data = await uploadGallery(
    {
      ...body,
      files: req.files,
      id_session: req.session.sessionId,
      id_user: req.session.userId,
      created_by: req.session.username,
    },
    customLog(req, { action: "téléchargement" })
  );

  // Log gallery creation
  logger.info(
    customLog(req, {
      message: `La galerie ${body.name} a été créé avec succés.`,
      action: "téléchargement",
    })
  );

  // Respond with success message and gallery data
  return res.status(201).json({
    success: true,
    message: "La galerie a été créée avec succés.",
    data,
  });
});

// Controller function to get all galleries
export const GetAllGalleries = tryCatch(async (req, res) => {
  // Retrieve all galleries from the service
  const { error } = getGallerysSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const { galleries: data, count } = await getAllGalleries(req.body);

  // Respond with success message and gallery data
  return res.status(200).json({
    success: true,
    message: "Galleries Successfully fetched",
    count,
    data,
  });
});

// Controller function to get all galleries that have no articles
export const GetAllGalleriesHaveNoArticles = tryCatch(async (req, res) => {
  // Retrieve all galleries from the service
  const { error } = getGallerysSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const { galleries: data, count } = await getAllGalleriesHaveNoArticles(
    req.body
  );

  // Respond with success message and gallery data
  return res.status(200).json({
    success: true,
    message: "Galleries Successfully fetched",
    count,
    data,
  });
});

export const GetOneGallery = tryCatch(async (req, res) => {
  // Retrieve one gallery from the service
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

  // Respond with success message and gallery data
  return res.status(200).json({
    success: true,
    message: "Gallery Successfully fetched",
    data,
  });
});

export const GetOtherImagesOfGallery = tryCatch(async (req, res) => {
  // Retrieve other images of gallery from the service
  const { error } = galleryIdSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const data = await getOtherImagesOfGallery(req.body);

  // Respond with success message and images data
  return res.status(200).json({
    success: true,
    message: "Images Successfully fetched",
    data,
  });
});

// Controller function to delete a gallery
export const DeleteGallery = tryCatch(async (req, res) => {
  // Validate the request body against the schema
  const { error } = galleryIdDeleteSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Delete the gallery and retrieve its name
  const { name } = await deleteGallery(
    req.body.galleryId,
    req.body.isConfirmed,
    customLog(req, { action: "suppression" })
  );

  logger.info(
    customLog(req, {
      message: `La galerie ${name} a été supprimé avec succés`,
      action: "suppression",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "La galerie a été supprimé avec succés.",
  });
});

// Controller function to search galleries
export const SearchGalleries = tryCatch(async (req, res) => {
  // Retrieve searched galleries from the service
  const { error } = searchSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const { galleries: data, count } = await searchGalleries(req.body);

  // Respond with success message and gallery data
  return res.status(200).json({
    success: true,
    message: "Galleries Successfully fetched",
    count,
    data,
  });
});
