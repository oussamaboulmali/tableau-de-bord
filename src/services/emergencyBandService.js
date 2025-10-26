import prisma from "../configs/database.js";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";

const logger = infoLogger("urgence");

export const getAllEmergencybands = async () => {
  const emergencybands = await prisma.aps2024_emergency_bands.findMany({
    select: {
      title: true,
      id_emergency_bands: true,
      is_publish: true,
      created_by: true,
      created_date: true,
      publish_by: true,
      unpublish_by: true,
      publish_down: true,
      publish_date: true,
      click_url: true,
      modified_by: true,
      modified_date: true,
      type: true,
    },
    orderBy: {
      publish_date: "desc",
    },
  });

  const emergencybandsFormatted = emergencybands.map((emergencyband) => {
    const { id_emergency_bands, ...rest } = emergencyband;

    return {
      id_emergency_bands: Number(id_emergency_bands),
      ...rest,
    };
  });

  return emergencybandsFormatted;
};

export const getOneEmergencyband = async ({ emergencybandId }) => {
  const emergencyband = await prisma.aps2024_emergency_bands.findUnique({
    where: {
      id_emergency_bands: emergencybandId,
    },
  });

  if (!emergencyband) {
    throw new ErrorHandler(404, "emergencyband inexistant.");
  }

  const { id_emergency_bands, id_session, ...rest } = emergencyband;

  return {
    id_emergency_bands: Number(id_emergency_bands),
    ...rest,
  };
};

export const createEmergencyband = async (emergencybandData, logData) => {
  const { is_publish = false, ...rest } = emergencybandData;

  if (is_publish) {
    const otherEmergencyBand = await prisma.aps2024_emergency_bands.findFirst({
      where: {
        is_publish: true,
        type: { not: rest.type },
      },
    });

    if (otherEmergencyBand) {
      logger.error({
        ...logData,
        message: `Tentative de création d'une bande d'alerte en conflit avec une autre déjà publiée.`,
      });
      throw new ErrorHandler(
        401,
        "Impossible de publier deux bandes d'alerte urgentes et importantes en même temps."
      );
    }
  }

  const emergencyband = await prisma.aps2024_emergency_bands.create({
    data: {
      ...rest,
      ...(is_publish && {
        is_publish: is_publish,
        publish_date: new Date(),
        publish_by: rest.created_by,
      }),
    },
    select: {
      id_emergency_bands: true,
      is_publish: true,
    },
  });

  return {
    id_emergency_bands: Number(emergencyband.id_emergency_bands),
  };
};

// Function to change the state (publish/unpublish) of a emergencyband
export const changeStateEmergencyband = async (userData, logData) => {
  const { emergencybandId, actionBy } = userData;

  // Check if the emergencyband to change state exists in the database
  const existingEmergencybands =
    await prisma.aps2024_emergency_bands.findUnique({
      where: { id_emergency_bands: emergencybandId },
      select: {
        is_publish: true,
        type: true,
      },
    });

  // If the emergencyband doesn't exist, throw an error
  if (!existingEmergencybands) {
    logger.error({
      ...logData,
      action: "publication/depublication",
      message: `Une tentative de modification de l'état d'une bande d'alerte inexistante.
      Informations de débogage :
      ID de la bande d'alerte demandé : ${emergencybandId}`,
    });
    throw new ErrorHandler(401, "Emergencyband inexistante");
  }

  if (!existingEmergencybands.is_publish) {
    const otherEmergencyBand = await prisma.aps2024_emergency_bands.findFirst({
      where: {
        is_publish: true,
        type: { not: existingEmergencybands.type },
      },
    });

    if (otherEmergencyBand) {
      logger.error({
        ...logData,
        message: `Tentative de publication d'une bande d'alerte en conflit avec une autre déjà publiée.`,
      });
      throw new ErrorHandler(
        401,
        "Impossible de publier deux bandes d'alerte urgentes et importantes en même temps."
      );
    }
  }

  const updateData = existingEmergencybands.is_publish
    ? { publish_down: new Date(), unpublish_by: actionBy }
    : { publish_date: new Date(), publish_by: actionBy };

  await prisma.aps2024_emergency_bands.update({
    where: {
      id_emergency_bands: emergencybandId,
    },
    data: {
      is_publish: !existingEmergencybands.is_publish,
      ...updateData,
    },
  });

  // Return the title and new state of the emergencyband
  return {
    title: existingEmergencybands.title,
    is_publish: existingEmergencybands.is_publish,
  };
};

// Function to update an existing emergencyband
export const updateEmergencyband = async (userData, logData) => {
  const { emergencybandId, modifiedBy, ...rest } = userData;

  // Check if the emergencyband to be updated exists in the database
  const existingEmergencyband = await prisma.aps2024_emergency_bands.findUnique(
    {
      where: { id_emergency_bands: emergencybandId },
      select: {
        title: true,
        click_url: true,
      },
    }
  );

  // If the emergencyband doesn't exist, throw an error
  if (!existingEmergencyband) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'une bande d'alerte inexistante.
      Informations de débogage :
      ID bande d'alerte demandé : ${emergencybandId}`,
    });
    throw new ErrorHandler(401, "Bande d'alerte inexistante");
  }

  // Update the emergencyband in the database
  const updatedEmergencyband = await prisma.aps2024_emergency_bands.update({
    where: {
      id_emergency_bands: emergencybandId,
    },
    data: {
      ...rest,
      modified_by: modifiedBy,
      modified_date: new Date(),
    },
    select: {
      title: true,
      click_url: true,
    },
  });

  // Generate and return the log message
  const logMessage = generateEmergencybandLogMessage(
    existingEmergencyband,
    updatedEmergencyband
  );
  return logMessage;
};

function generateEmergencybandLogMessage(
  oldEmergencyband,
  updatedEmergencyband
) {
  const changes = [];

  if (oldEmergencyband.title !== updatedEmergencyband.title) {
    changes.push(
      `titre: "${oldEmergencyband.title}" → "${updatedEmergencyband.title}"`
    );
  }

  if (oldEmergencyband.click_url !== updatedEmergencyband.click_url) {
    changes.push(
      `click url: "${oldEmergencyband.click_url || "non défini"}" → "${
        updatedEmergencyband.click_url || "non défini"
      }"`
    );
  }

  if (changes.length > 0) {
    return `Les informations de la bande d'alerte "${
      oldEmergencyband.title
    }" ont été modifiées avec succès :
     ${changes.join(", \n ")} `;
  }

  return `Aucun changement détecté pour la bande d'alerte "${oldEmergencyband.title}".`;
}
