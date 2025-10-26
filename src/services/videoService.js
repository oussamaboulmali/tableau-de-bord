import prisma from "../configs/database.js";
import { processAndStoreImages } from "../helpers/imageHelper.js";

import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { createAlias } from "../utils/createAlias.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";

const logger = infoLogger("videos");

export const getAllVideo = async () => {
  const videos = await prisma.aps2024_videos.findMany({
    orderBy: [
      {
        created_date: "desc",
      },
    ],
    include: {
      aps2024_images: {
        select: {
          url: true,
        },
      },
    },
  });

  const videoFormatted = videos.map((video) => {
    const { id_video, aps2024_images, id_session, id_user, id_image, ...rest } =
      video;
    return {
      id_video: Number(id_video),
      url: aps2024_images.url,
      ...rest,
    };
  });

  return videoFormatted;
};

export const getHomePageVideos = async () => {
  // Only consider published, non-main videos

  // 1. Get pinned videos for positions 1-4
  const pinnedVideos = await prisma.aps2024_videos.findMany({
    where: {
      is_publish: true,
      is_main: false,
      position: { not: null },
    },
    orderBy: { position: "asc" },
    select: {
      id_video: true,
      name: true,
      description: true,
      position: true,
      publish_date: true,
      aps2024_images: {
        select: {
          url: true,
        },
      },
    },
  });

  // Create a map to track which positions are filled
  const filledPositions = new Map();
  pinnedVideos.forEach((video) => {
    if (video.position >= 1 && video.position <= 4) {
      filledPositions.set(video.position, video);
    }
  });

  // 2. Get unpinned videos to fill remaining positions
  const neededUnpinnedCount = 4 - filledPositions.size;
  let unpinnedVideos = [];

  if (neededUnpinnedCount > 0) {
    unpinnedVideos = await prisma.aps2024_videos.findMany({
      where: {
        is_publish: true,
        is_main: false,
        position: null,
      },
      orderBy: { publish_date: "desc" },
      take: neededUnpinnedCount,
      select: {
        id_video: true,
        name: true,
        description: true,
        position: true,
        publish_date: true,
        aps2024_images: {
          select: {
            url: true,
          },
        },
      },
    });
  }

  // 3. Merge results to create final ordered list
  const finalVideos = [];

  // First add pinned videos to their positions
  for (let position = 1; position <= 4; position++) {
    if (filledPositions.has(position)) {
      finalVideos[position - 1] = filledPositions.get(position);
    }
  }

  // Then fill empty positions with unpinned videos
  let unpinnedIndex = 0;
  for (let position = 1; position <= 4; position++) {
    if (
      !filledPositions.has(position) &&
      unpinnedIndex < unpinnedVideos.length
    ) {
      finalVideos[position - 1] = unpinnedVideos[unpinnedIndex];
      unpinnedIndex++;
    }
  }

  const videoFormatted = finalVideos.map((video) => {
    const { id_video, aps2024_images, ...rest } = video;
    return {
      id_video: Number(id_video),
      url: aps2024_images.url,
      is_pinned: rest.position ? true : false,
      ...rest,
    };
  });

  return videoFormatted;
};

export const getPinnedVedio = async () => {
  const videos = await prisma.aps2024_videos.findMany({
    orderBy: [
      {
        position: "asc",
      },
    ],
    where: {
      position: { not: null },
      is_publish: true,
      is_main: false,
    },
    select: {
      id_video: true,
      name: true,
      description: true,
      position: true,
      created_date: true,
      aps2024_images: {
        select: {
          url: true,
        },
      },
    },
  });

  const videoFormatted = videos.map((video) => {
    const { id_video, aps2024_images, ...rest } = video;
    return {
      id_video: Number(id_video),
      url: aps2024_images.url,
      ...rest,
    };
  });

  return videoFormatted;
};

export const getAllVideoWithPaginations = async (data) => {
  const { pageSize, page, order = { created_date: "desc" } } = data;

  const offset = (page - 1) * pageSize;

  const videos = await prisma.aps2024_videos.findMany({
    take: parseInt(pageSize),
    skip: parseInt(offset),
    orderBy: [order],
    include: {
      aps2024_images: {
        select: {
          url: true,
        },
      },
    },
  });

  const videosCount = await prisma.aps2024_videos.count();

  const videoFormatted = videos.map((video) => {
    const { id_video, aps2024_images, id_session, id_user, id_image, ...rest } =
      video;
    return {
      id_video: Number(id_video),
      url: aps2024_images.url,
      ...rest,
    };
  });

  return { videos: videoFormatted, count: videosCount };
};

export const searchVideo = async (data) => {
  const { searchText, pageSize, page, order = { created_date: "desc" } } = data;
  // Calculate offset based on page and pageSize
  const offset = pageSize * (page - 1);

  if (searchText == "") {
    const { videos, count } = await getAllVideoWithPaginations({
      pageSize,
      page,
      order,
    });
    return { videos, count };
  }
  // Search for tag by name with pagination
  const videos = await prisma.aps2024_videos.findMany({
    where: {
      OR: [
        {
          name: {
            contains: searchText,
            mode: "insensitive", // Case-insensitive search
          },
        },
        {
          description: {
            contains: searchText,
            mode: "insensitive", // Case-insensitive search
          },
        },
      ],
    },
    take: pageSize, // Limit number of results per page
    skip: offset, // Skip results based on page and pageSize
    distinct: "id_video",
    orderBy: [order],
    include: {
      aps2024_images: {
        select: {
          url: true,
        },
      },
    },
  });
  // Get total count of results
  const totalCount = await prisma.aps2024_videos.count({
    where: {
      OR: [
        {
          name: {
            contains: searchText,
            mode: "insensitive", // Case-insensitive search
          },
        },
        {
          description: {
            contains: searchText,
            mode: "insensitive", // Case-insensitive search
          },
        },
      ],
    },
  });

  const videoFormatted = videos.map((video) => {
    const { id_video, aps2024_images, id_session, id_user, id_image, ...rest } =
      video;
    return {
      id_video: Number(id_video),
      url: aps2024_images.url,
      ...rest,
    };
  });

  return { videos: videoFormatted, count: totalCount };
};

export const getOneVideo = async ({ videoId }) => {
  const video = await prisma.aps2024_videos.findUnique({
    where: {
      id_video: videoId,
    },
    include: {
      aps2024_images: {
        select: {
          id_image: true,
          url: true,
        },
      },
    },
  });

  if (!video) {
    throw new ErrorHandler(404, "video inexistant.");
  }

  const { id_video, id_image, id_session, aps2024_images, ...rest } = video;

  return {
    id_video: Number(id_video),
    ...rest,
    image: {
      id_image: Number(aps2024_images.id_image),
      url: aps2024_images.url,
    },
  };
};

export const createVideo = async (videoData, logData) => {
  const {
    file,
    name,
    is_main = false,
    position = null,
    categorieId,
    ...rest
  } = videoData;

  let imageId;
  // Check if name is already taken
  const existingName = await prisma.aps2024_videos.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive", // Case-insensitive search
      },
    },
  });

  if (existingName) {
    logger.error({
      ...logData,
      message: `Une tentative de créer une nouvelle video avec un nom ${existingName.name} déjà pris.
      Informations de débogage :
      Nom demandé : ${name}`,
    });
    throw new ErrorHandler(409, "Nom du video déjà pris");
  }

  if (file === undefined) {
    logger.error({
      ...logData,
      message: `Une tentative de créer une video sans image.`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas créer une video sans image"
    );
  }

  const { path: imagePath, filename, originalname } = file;
  const data = await uploadImageVideo({
    ...rest,
    name,
    originalname,
    imagePath,
    filename,
  });

  imageId = data.id_image;

  // If a position is requested and it's not a main video
  if (position && !is_main) {
    // Check if a video is already pinned to this position
    const existingPinned = await prisma.aps2024_videos.findFirst({
      where: { next_position: position },
    });

    // If a video is already pinned to this position, unpin it
    if (existingPinned) {
      await prisma.aps2024_videos.update({
        where: { id_video: existingPinned.id_video },
        data: { next_position: null },
      });
    }
  }

  const video = await prisma.aps2024_videos.create({
    data: {
      ...rest,
      name: name,
      alias: createAlias(name),
      id_image: imageId,
      is_main,
      next_position: position,
    },
    select: {
      id_video: true,
      name: true,
      aps2024_images: {
        select: {
          url: true,
        },
      },
    },
  });

  return {
    id_video: Number(video.id_video),
    name: video.name,
    url: video.aps2024_images.url,
  };
};

// Function to change the state (publish/unpublish) of a video
export const changeStateVideo = async (userData, logData) => {
  const { videoId, actionBy } = userData;

  // Check if the video to change state exists in the database
  const existingVideo = await prisma.aps2024_videos.findUnique({
    where: { id_video: videoId },
    select: {
      name: true,
      is_publish: true,
      position: true,
      next_position: true,
      is_main: true,
    },
  });

  // If the video doesn't exist, throw an error
  if (!existingVideo) {
    logger.error({
      ...logData,
      action: "publication/depublication",
      message: `Une tentative de modification de l'état d'une video inexistante.
      Informations de débogage :
      ID du video demandé : ${videoId}`,
    });
    throw new ErrorHandler(400, "Video inexistante");
  }

  if (existingVideo.is_main && existingVideo.is_publish) {
    logger.error({
      ...logData,
      action: "publication/depublication",
      message: `Une tentative de depublication d'une video principale.
      Informations de débogage :
      ID du video demandé : ${videoId}`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas annuler la publication d'une vidéo principale"
    );
  }

  const updateData = existingVideo.is_publish
    ? {
        publish_down: new Date(),
        unpublish_by: actionBy,
        position: null,
        next_position: null,
      }
    : { publish_date: new Date(), publish_by: actionBy, next_position: null };

  // When publishing, move next_position to pinned_position if it exists and if the vedio is not already in pinned_position
  if (
    !existingVideo.is_publish &&
    !existingVideo.position &&
    existingVideo.next_position
  ) {
    // Check if another video is already pinned to this position
    const existingPinned = await prisma.aps2024_videos.findFirst({
      where: {
        position: existingVideo.next_position,
        id_video: { not: videoId },
      },
      select: {
        id_video: true,
      },
    });

    // If another video is already pinned to this position, unpin it
    if (existingPinned) {
      await prisma.aps2024_videos.update({
        where: { id_video: existingPinned.id_video },
        data: { position: null },
      });
    }

    // Move next_position to pinned_position
    updateData.position = existingVideo.next_position;
  }

  // Find current main video
  const currentMain = await prisma.aps2024_videos.findMany({
    where: {
      is_main: true,
      is_publish: true,
    },
    select: {
      id_video: true,
    },
  });

  if (currentMain) {
    for (let videoMain of currentMain) {
      await prisma.aps2024_videos.update({
        where: { id_video: videoMain.id_video },
        data: { is_main: false },
      });
    }
  }

  // Update the state of the video in the database
  await prisma.aps2024_videos.update({
    where: {
      id_video: videoId,
    },
    data: {
      is_publish: !existingVideo.is_publish,
      ...updateData,
    },
  });

  // Return the name and new state of the video
  return {
    name: existingVideo.name,
    is_publish: existingVideo.is_publish,
  };
};

// Function to update an existing video
export const updateVideo = async (userData, logData) => {
  const {
    videoId,
    modifiedBy,
    name,
    file,
    description,
    created_by,
    lien_video,
    ...rest
  } = userData;
  let imageId;
  // Check if the video to be updated exists in the database
  const existingVideo = await prisma.aps2024_videos.findUnique({
    where: { id_video: videoId },
    select: {
      id_image: true,
      name: true,
      description: true,
      lien_video: true,
      aps2024_images: {
        select: {
          id_image: true,
          name: true,
          description: true,
        },
      },
    },
  });

  // If the video doesn't exist, throw an error
  if (!existingVideo) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'une video inexistante.
      Informations de débogage :
      ID du video demandé : ${videoId}`,
    });
    throw new ErrorHandler(400, "Video inexistante");
  }

  // Check if the new name already exists in the database
  if (name) {
    const existingName = await prisma.aps2024_videos.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
        id_video: {
          not: videoId, // Exclude the current video
        },
      },
    });
    // If the new name already exists, throw an error
    if (existingName) {
      logger.error({
        ...logData,
        message: `Une tentative de modifer une video avec un nom ${existingName.name} déjà pris.
          Informations de débogage :
          Nom demandé : ${name}`,
      });
      throw new ErrorHandler(400, "Nom déjà pris");
    }
  }

  if (file !== undefined) {
    // If a new file is uploaded, upload it and get the new image ID
    const { path: imagePath, filename, originalname } = file;
    const data = await uploadImageVideo({
      ...rest,
      created_by,
      description:
        description === undefined
          ? existingVideo.aps2024_images.description
          : description,
      name: name === undefined ? existingVideo.aps2024_images.name : name,
      originalname,
      imagePath,
      filename,
    });

    imageId = data.id_image;
  } else if (name !== undefined || description !== undefined) {
    // If no new file is uploaded but name or description is changed,
    // update the existing image's name or description
    await prisma.aps2024_images.update({
      where: {
        id_image: existingVideo.id_image,
      },
      data: {
        name: name === undefined ? existingVideo.aps2024_images.name : name,
        description:
          description === undefined
            ? existingVideo.aps2024_images.description
            : description,
        modified_by: modifiedBy,
        modified_date: new Date(),
      },
    });
    // Keep the same image ID
    imageId = existingVideo.id_image;
  } else {
    // No changes to the image
    imageId = existingVideo.id_image;
  }

  // Update the video in the database
  const updatedVideo = await prisma.aps2024_videos.update({
    where: {
      id_video: videoId,
    },
    data: {
      name: name,
      ...(name !== undefined && { alias: createAlias(name) }),
      description: description,
      modified_by: modifiedBy,
      modified_date: new Date(),
      id_image: imageId,
      lien_video,
    },
    select: {
      name: true,
      description: true,
      lien_video: true,
      aps2024_images: {
        select: {
          id_image: true,
          url: true,
        },
      },
    },
  });

  // Return the name of the updated video
  const logMessage = generateVideoLogMessage(existingVideo, updatedVideo);
  return logMessage;
};

export const pinVedio = async (videoData, logData) => {
  const { videoId, is_pinned, position, modified_by } = videoData;

  const existingVideo = await prisma.aps2024_videos.findUnique({
    where: { id_video: videoId },
    select: {
      id_video: true,
      name: true,
      is_publish: true,
      is_main: true,
      position: true,
    },
  });

  // If the video doesn't exist, throw an error
  if (!existingVideo) {
    logger.error({
      ...logData,
      message: `Une tentative d'épingler une video inexistante.
      Informations de débogage :
      ID du video demandé : ${videoId}`,
    });
    throw new ErrorHandler(400, "Video inexistante");
  }

  if (!existingVideo.is_publish) {
    logger.error({
      ...logData,
      message: `Une tentative d'épingler une video non publié.
      Informations de débogage :
      ID du video demandé : ${videoId}
      Titre du video demandé : ${existingVideo.name}`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas épingler une video non publié."
    );
  }

  if (existingVideo.is_main) {
    logger.error({
      ...logData,
      message: `Une tentative d'épingler une video principale.
      Informations de débogage :
      ID du video demandé : ${videoId}
      Titre du video demandé : ${existingVideo.name}`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas épingler une video principale"
    );
  }

  // if (!is_pinned && !existingVideo.is_pinned) {
  //   throw new ErrorHandler(
  //     400,
  //     "Vous ne pouvez pas dépingler une video déja dépingler."
  //   );
  // }

  if (is_pinned) {
    await prisma.$transaction(async (prisma) => {
      // Check if another video is already pinned to this position
      const existingPosition = await prisma.aps2024_videos.findFirst({
        where: {
          position,
          NOT: { id_video: videoId },
        },
        select: {
          id_video: true,
        },
      });

      // If a different video is already pinned to this position, unpin it
      if (existingPosition) {
        await prisma.aps2024_videos.update({
          where: { id_video: existingPosition.id_video },
          data: { position: null, next_position: null },
        });
      }

      // pin the new video provided
      await prisma.aps2024_videos.update({
        where: { id_video: existingVideo.id_video },
        data: {
          position,
          next_position: null,
          modified_by,
          modified_date: new Date(),
        },
      });
    });
  } else {
    // set video is pinned to false
    await prisma.aps2024_videos.update({
      where: { id_video: videoId },
      data: {
        modified_by,
        modified_date: new Date(),
        next_position: null,
        position: null,
      },
    });
  }

  // const homePageVideos = await getHomePageVideos();

  return {
    name: existingVideo.name,
  };
};

export const getOtherVideosPublished = async (data) => {
  const {
    pageSize = 10,
    page = 1,
    order = { created_date: "desc" },
    videoId,
  } = data;

  const offset = (page - 1) * pageSize;
  const videos = await prisma.aps2024_videos.findMany({
    take: parseInt(pageSize),
    skip: parseInt(offset),
    orderBy: [order],
    where: {
      NOT: {
        id_video: videoId,
      },
      is_publish: true,
      is_main: false,
    },
    include: {
      aps2024_images: {
        select: {
          id_image: true,
          url: true,
        },
      },
    },
  });

  const vedioCount = await prisma.aps2024_videos.count({
    where: {
      NOT: {
        id_video: videoId,
      },
      is_publish: true,
      is_main: false,
    },
  });

  const videosFormatted = videos.map((video) => {
    const { id_video, aps2024_images, id_session, id_user, id_image, ...rest } =
      video;
    return {
      id_video: Number(id_video),
      url: aps2024_images.url,
      ...rest,
    };
  });

  return {
    videos: videosFormatted,
    count: vedioCount,
  };
};

export const searchOtherVideosPublished = async (data) => {
  const {
    pageSize = 10,
    page = 1,
    order = { created_date: "desc" },
    videoId,
    searchText,
  } = data;

  if (searchText == "") {
    const { videos, count } = await getOtherVideosPublished({
      pageSize,
      page,
      order,
    });
    return { videos, count };
  }
  const offset = (page - 1) * pageSize;
  const videos = await prisma.aps2024_videos.findMany({
    take: parseInt(pageSize),
    skip: parseInt(offset),
    orderBy: [order],
    where: {
      NOT: {
        id_video: videoId,
      },
      is_publish: true,
      is_main: false,
      name: {
        contains: searchText,
        mode: "insensitive",
      },
    },
    include: {
      aps2024_images: {
        select: {
          id_image: true,
          url: true,
        },
      },
    },
  });

  const vedioCount = await prisma.aps2024_videos.count({
    where: {
      NOT: {
        id_video: videoId,
      },
      is_publish: true,
      is_main: false,
      name: {
        contains: searchText,
        mode: "insensitive",
      },
    },
  });

  const videosFormatted = videos.map((video) => {
    const { id_video, aps2024_images, id_session, id_user, id_image, ...rest } =
      video;
    return {
      id_video: Number(id_video),
      url: aps2024_images.url,
      ...rest,
    };
  });

  return {
    videos: videosFormatted,
    count: vedioCount,
  };
};

// Swap main video (make this video main and demote the current main)
export const swapMainVideo = async (videoData, logData) => {
  const { videoId, modified_by } = videoData;
  const existingVideo = await prisma.aps2024_videos.findUnique({
    where: { id_video: videoId },
    select: {
      id_video: true,
      name: true,
      is_publish: true,
      is_main: true,
      position: true,
    },
  });

  // If the video doesn't exist, throw an error
  if (!existingVideo) {
    logger.error({
      ...logData,
      message: `Une tentative de rendre cette vidéo principale une video inexistante.
      Informations de débogage :
      ID du video demandé : ${videoId}`,
    });
    throw new ErrorHandler(400, "Video inexistante");
  }

  if (!existingVideo.is_publish) {
    logger.error({
      ...logData,
      message: `Une tentative de rendre cette vidéo principale une video non publié.
      Informations de débogage :
      ID du video demandé : ${videoId}
      Titre du video demandé : ${existingVideo.name}`,
    });
    throw new ErrorHandler(
      400,
      "Vous ne pouvez pas rendre cette vidéo principale car elle n'est pas publiée."
    );
  }
  // Find current main video
  const currentMain = await prisma.aps2024_videos.findMany({
    where: {
      is_main: true,
      is_publish: true,
    },
    select: {
      id_video: true,
    },
  });

  const result = await prisma.$transaction(async (prisma) => {
    // If there's a current main video, demote it
    if (currentMain) {
      for (let videoMain of currentMain) {
        await prisma.aps2024_videos.update({
          where: { id_video: videoMain.id_video },
          data: { is_main: false },
        });
      }
    }

    // Promote the new video (clear any position data)
    return await prisma.aps2024_videos.update({
      where: { id_video: existingVideo.id_video },
      data: {
        is_main: true,
        position: null,
        next_position: null,
        modified_by,
        modified_date: new Date(),
      },
      select: {
        name: true,
      },
    });
  });

  return result.name;
};

// Function to upload an image
const uploadImageVideo = async (imageData) => {
  const { name, originalname, imagePath, filename, lien_video, ...data } =
    imageData;

  // Process and store images
  const processedImageUrl = await processAndStoreImages(
    imagePath,
    filename,
    originalname,
    "video"
  );

  // Create new image record in the database
  const image = await prisma.aps2024_images.create({
    data: {
      name: name,
      url: processedImageUrl,
      source: 5,
      ...data,
    },
    select: {
      id_image: true,
      url: true,
    },
  });

  // Return the created image record
  return {
    ...image,
    id_image: Number(image.id_image),
  };
};

function generateVideoLogMessage(oldVideo, updatedVideo) {
  const changes = [];

  if (oldVideo.name !== updatedVideo.name) {
    changes.push(`name: "${oldVideo.name}" → "${updatedVideo.name}"`);
  }

  if (oldVideo.description !== updatedVideo.description) {
    changes.push(
      `description: "${oldVideo.description || "non défini"}" → "${
        updatedVideo.description || "non défini"
      }"`
    );
  }

  if (oldVideo.lien_video !== updatedVideo.lien_video) {
    changes.push(
      `lien_video: "${oldVideo.lien_video || "non défini"}" → "${
        updatedVideo.lien_video || "non défini"
      }"`
    );
  }

  if (oldVideo.id_image !== updatedVideo.aps2024_images.id_image) {
    changes.push(`image: changée`);
  }

  if (changes.length > 0) {
    return `Les informations du video "${
      oldVideo.name
    }" ont été modifiées avec succès :
     ${changes.join(", \n ")} `;
  }

  return `Aucun changement détecté pour le video "${oldVideo.name}".`;
}
