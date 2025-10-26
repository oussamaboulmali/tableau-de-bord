import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { ValidationError } from "../middlewares/errorMiddleware.js";
import { createArchive } from "../services/migrationService.js";
import {
  changeStateVideo,
  createVideo,
  getAllVideo,
  getAllVideoWithPaginations,
  getHomePageVideos,
  getOneVideo,
  getOtherVideosPublished,
  getPinnedVedio,
  pinVedio,
  searchOtherVideosPublished,
  searchVideo,
  swapMainVideo,
  updateVideo,
} from "../services/videoService.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";
import { tryCatch } from "../utils/tryCatch.js";
import {
  getVideoschema,
  videoIdSchema,
  videoSchema,
  updateVideoSchema,
  searchVideoSchema,
  pinVideoSchema,
  searchVideoPubishedSchema,
  getVideoPubishedSchema,
} from "../validations/vedioValidation.js";

// Logger instance for logging video-related actions
const logger = infoLogger("videos");

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
// Controller function to get all videos
export const GetAllVideo = tryCatch(async (req, res) => {
  // Retrieve all videos from the service
  const data = await getAllVideo();

  // Respond with success message and video data
  return res.status(200).json({
    success: true,
    message: "Videos Successfully fetched",
    data,
  });
});

// Controller function to get all pinned videos
export const GetPinnedVedio = tryCatch(async (req, res) => {
  // Retrieve all videos from the service
  const data = await getPinnedVedio();

  // Respond with success message and video data
  return res.status(200).json({
    success: true,
    message: "Pinned Videos Successfully fetched",
    data,
  });
});

export const GetHomePageVideos = tryCatch(async (req, res) => {
  // Retrieve all videos from the service
  const data = await getHomePageVideos();

  // Respond with success message and video data
  return res.status(200).json({
    success: true,
    message: "Home Page Videos Successfully fetched",
    data,
  });
});

// Controller function to get all videos
export const GetAllVideoWithPaginations = tryCatch(async (req, res) => {
  const { error } = getVideoschema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  // Retrieve all videos from the service
  const { videos: data, count } = await getAllVideoWithPaginations(req.body);

  // Respond with success message and tag data
  return res.status(200).json({
    success: true,
    message: "Videos Successfully fetched",
    count,
    data,
  });
});

export const GetOtherVideosPublished = tryCatch(async (req, res) => {
  const { error } = getVideoPubishedSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const { videos: data, count } = await getOtherVideosPublished(req.body);

  return res.status(200).json({
    success: true,
    message: "Videos Successfully fetched",
    count,
    data,
  });
});

export const SearchVideo = tryCatch(async (req, res) => {
  const { error } = searchVideoSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  // Retrieve all videos from the service
  const { videos: data, count } = await searchVideo(req.body);

  // Respond with success message and tag data
  return res.status(200).json({
    success: true,
    message: "Videos Successfully fetched",
    count,
    data,
  });
});

export const SearchOtherVideosPublished = tryCatch(async (req, res) => {
  // Retrieve all videos from the service
  const { error } = searchVideoPubishedSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const { videos: data, count } = await searchOtherVideosPublished(req.body);

  // Respond with success message and image data
  return res.status(200).json({
    success: true,
    message: "Videos Successfully fetched",
    count,
    data,
  });
});

export const GetOneVideo = tryCatch(async (req, res) => {
  // Retrieve all videos from the service
  const { error } = videoIdSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const data = await getOneVideo(req.body);

  // Respond with success message and video data
  return res.status(200).json({
    success: true,
    message: "Video Successfully fetched",
    data,
  });
});

// Controller function to create a new video
export const CreateVideo = tryCatch(async (req, res) => {
  const { position, is_main } = req.body;
  const body = {
    ...req.body,
    ...(position !== undefined && { position: JSON.parse(position) }),
    ...(is_main !== undefined && { is_main: JSON.parse(is_main) }),
  };

  // Validate the request body against the schema
  const { error } = videoSchema.validate(body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the createvideoe service function to create a new video
  const data = await createVideo(
    {
      ...body,
      file: req.file,
      id_session: req.session.sessionId,
      id_user: req.session.userId,
      created_by: req.session.username,
    },
    customLog(req, { action: "creation" })
  );

  // Log video creation
  logger.info(
    customLog(req, {
      message: `Une nouvelle Video a été créé avec le titre : ${data.name}"`,
      action: "creation",
    })
  );

  // Respond with success message and video data
  return res.status(201).json({
    success: true,
    message: "Video créé avec succès.",
    data,
  });
});

// Controller function to update a video
export const UpdateVideo = tryCatch(async (req, res) => {
  const body = {
    ...req.body,
    videoId: JSON.parse(req.body.videoId),
  };
  // Validate the request body against schema
  const { error } = updateVideoSchema.validate(body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the video and retrieve its name

  const logMessage = await updateVideo(
    {
      ...body,
      file: req.file,
      modifiedBy: req.session.username,
      id_session: req.session.sessionId,
      id_user: req.session.userId, // if new image uploded for when updating video image
      created_by: req.session.username, // if new image uploded for when updating video image
    },
    customLog(req, { action: "modification" })
  );

  // Update the video and retrieve its name
  logger.info(
    customLog(req, {
      message: logMessage,
      action: "modification",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "La Video modifié avec succès.",
  });
});

// Controller function to change the state of a video (publish/depublish)
export const ChangeStateVideo = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = videoIdSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Change the state of the video and retrieve its name and new state
  const { name, is_publish } = await changeStateVideo(
    {
      ...req.body,
      actionBy: req.session.username,
    },
    customLog(req)
  );

  // Log video state change
  logger.info(
    customLog(req, {
      message: `La video : "${name}" a été ${
        is_publish ? "depublier" : "publier"
      } avec succés.`,
      action: `${is_publish ? "depublication" : "publication"}`,
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "L'état du video a été modifié avec succés.",
  });
});

export const PinVideo = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = pinVideoSchema.validate(req.body);

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
  const name = await pinVedio(
    {
      ...req.body,
      modified_by: req.session.username,
    },
    customLog(req, { action: "pinning/unpinning" })
  );

  // Update the article and retrieve its name
  logger.info(
    customLog(req, {
      message: `la video "${name}" a été  ${
        req.body.is_pinned ? "épinglé" : "dépinglé"
      }  avec succés.`,
      action: "pinning/unpinning",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "La Video a été modifié avec succès.",
  });
});

export const SwapMainVideo = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = videoIdSchema.validate(req.body);

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
  const name = await swapMainVideo(
    {
      ...req.body,
      modified_by: req.session.username,
    },
    customLog(req, { action: "vedio principale" })
  );

  // Update the article and retrieve its name
  logger.info(
    customLog(req, {
      message: `la video "${name}" a été rendue principale avec succés.`,
      action: "vedio principale",
    })
  );

  // Respond with success message
  return res.status(200).json({
    success: true,
    message: "La Video a été modifié avec succès.",
  });
});

export const CreateArchive = tryCatch(async (req, res) => {
  //console.log(req.body);

  await createArchive(req.body, req.file);

  return res.status(201).json({
    success: true,
    message: "Archive a été creé avec succès.",
  });
});
