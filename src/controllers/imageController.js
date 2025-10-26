import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { ValidationError } from "../middlewares/errorMiddleware.js";
import {
  deleteImage,
  getAllImages,
  getAllImagesWithPaginations,
  getAllIndexes,
  getOneImage,
  searchImages,
  updateImage,
  uploadImage,
} from "../services/imageService.js";

import { infoLogger, createLogEntry } from "../utils/logger.js";
import { tryCatch } from "../utils/tryCatch.js";
import {
  getImagesSchema,
  imageIdSchema,
  imageSchema,
  searchSchema,
  updateImageSchema,
} from "../validations/imageValidation.js";

// Logger instance for logging image-related actions
const logger = infoLogger("images");

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
// Controller function to get all images
export const GetAllImagesWithPaginations = tryCatch(async (req, res) => {
  // Retrieve all images from the service
  const { error } = getImagesSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const { images: data, count } = await getAllImagesWithPaginations(req.body);

  // Respond with success message and image data
  return res.status(200).json({
    success: true,
    message: "Images Successfully fetched",
    count,
    data,
  });
});

export const GetAllImages = tryCatch(async (req, res) => {
  // Retrieve all images from the service

  const data = await getAllImages();

  // Respond with success message and image data
  return res.status(200).json({
    success: true,
    message: "Images Successfully fetched",
    data,
  });
});

// Controller function to get all images
export const GetAllIndexes = tryCatch(async (req, res) => {
  const data = await getAllIndexes();

  // Respond with success message and image data
  return res.status(200).json({
    success: true,
    message: "Indexes Successfully fetched",
    data,
  });
});

// Controller function to get all images
export const SearchImages = tryCatch(async (req, res) => {
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
  const { images: data, count } = await searchImages(req.body);

  // Respond with success message and image data
  return res.status(200).json({
    success: true,
    message: "Images Successfully fetched",
    count,
    data,
  });
});

export const GetOneImage = tryCatch(async (req, res) => {
  // Retrieve all images from the service
  const { error } = imageIdSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const data = await getOneImage(req.body);

  // Respond with success message and image data
  return res.status(200).json({
    success: true,
    message: "Image Successfully fetched",
    data,
  });
});
// Controller function to create a new image
export const UploadImage = tryCatch(async (req, res) => {
  const { type } = req.body;

  const body = {
    ...req.body,
    type: JSON.parse(type),
  };

  //Validate the request body against the schema
  const { error } = imageSchema.validate(body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  // Call the createCategorie service function to create a new image
  const { path: imagePath, filename, originalname } = req.file;
  const data = await uploadImage(
    {
      ...body,
      originalname,
      imagePath,
      filename,
      id_session: req.session.sessionId,
      id_user: req.session.userId,
      created_by: req.session.username,
    },
    customLog(req, { action: "téléchargement" })
  );

  // Log image creation
  logger.info(
    customLog(req, {
      message: `L'image ${req.body.name} avec l'url ${data.url} a été créé avec succés.`,
      action: "téléchargement",
    })
  );

  // Respond with success message and image data
  return res.status(201).json({
    success: true,
    message: "L'image a été créée avec succés.",
    data,
  });
});

// Controller function to delete a image
export const DeleteImage = tryCatch(async (req, res) => {
  // Validate the request body against the schema
  const { error } = imageIdSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Delete the image and retrieve its name
  const { name, url } = await deleteImage(
    req.body.imageId,
    customLog(req, { action: "suppression" })
  );

  logger.info(
    customLog(req, {
      message: `L'image ${name} avec l'url ${url} a été supprimé avec succés`,
      action: "suppression",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "L'image a été supprimé avec succés.",
  });
});

// Controller function to update a image
export const UpdateImage = tryCatch(async (req, res) => {
  // Validate the request body against the schema
  const { error } = updateImageSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the image and retrieve its name
  const { imageName } = await updateImage(
    {
      ...req.body,
      modified_by: req.session.username,
    },
    customLog(req, { action: "modification" })
  );

  // Log image update
  logger.info(
    customLog(req, {
      message: `L'image "${imageName}" a été modifié avec succés.`,
      action: "modification",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "L'image a été modifié avec succés.",
  });
});
