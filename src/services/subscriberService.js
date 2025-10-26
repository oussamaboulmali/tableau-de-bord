import prisma from "../configs/database.js";
import bcrypt from "bcryptjs";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";

const logger = infoLogger("abonne");

export const getAllSubscriber = async () => {
  const subscribers = await prisma.aps2024_subscriber.findMany({
    select: {
      id_subscriber: true,
      username: true,
      first_name: true,
      last_name: true,
      email: true,
      state: true,
      lastvisit_date: true,
    },
  });

  subscribers.sort((a, b) => {
    if (a.state === 1 && b.state !== 1) {
      return -1; // a comes before b
    } else if (a.state === 2 && b.state !== 1 && b.state !== 2) {
      return -1; // a comes before b
    } else if (a.state === 0 && (b.state === 1 || b.state === 2)) {
      return 1; // b comes before a
    } else {
      return 0; // no change in order
    }
  });

  return subscribers;
};

export const getOneSubscriber = async ({ subscriberId }) => {
  const subscriber = await prisma.aps2024_subscriber.findUnique({
    where: { id_subscriber: subscriberId },
  });

  if (!subscriber) {
    throw new ErrorHandler(404, "No Subscriber found");
  }

  const { login_attempts, otpTime, otpkey, password, ...data } = subscriber;

  return data;
};

export const createSubscriber = async (userData, logData) => {
  const { password, email, username, assignedby, ...rest } = userData;

  // Check if email is already taken
  const existingEmail = await prisma.aps2024_subscriber.findUnique({
    where: { email: email },
  });
  if (existingEmail) {
    logger.error({
      ...logData,
      message: `Une tentative de créer un nouveau abonné avec un email ${email} déjà pris.
      Informations de débogage :
      Email demandé : ${email}`,
    });
    throw new ErrorHandler(401, "Email déjà pris");
  }

  // Check if username is already taken
  const existingSubscriber = await prisma.aps2024_subscriber.findUnique({
    where: { username: username },
  });

  if (existingSubscriber) {
    logger.error({
      ...logData,
      message: `Une tentative de créer un nouveau abonné avec un username ${username} déjà pris.
      Informations de débogage :
      Username demandé : ${username}`,
    });
    throw new ErrorHandler(401, "Username déjà pris");
  }

  // Hash the password
  const salt = await bcrypt.genSalt();
  const hashedPassword = await bcrypt.hash(password, salt);

  //Create a new subscriber
  const newSubscriber = await prisma.aps2024_subscriber.create({
    data: {
      username,
      email,
      password: hashedPassword,
      register_by: assignedby,
      ...rest,
    },
    select: {
      id_subscriber: true,
      username: true,
      email: true,
    },
  });

  return {
    subscriberId: newSubscriber.id_subscriber,
    username: newSubscriber.username,
    email: newSubscriber.email,
  };
};

export const resetSubscriberPassword = async (userdata, logData) => {
  const { subscriberId, password, modifiedby } = userdata;

  const subscriber = await prisma.aps2024_subscriber.findUnique({
    where: {
      id_subscriber: subscriberId,
    },
  });

  if (!subscriber) {
    logger.error({
      ...logData,
      message: `Une tentative de réinitialisation du mot de passe pour un abonné inexistant.
      Informations de débogage :
      ID de l'abonné demandé : ${subscriberId}`,
    });
    throw new ErrorHandler(401, "Abonné inexistant.");
  }

  if (subscriber.state === 0) {
    logger.error({
      ...logData,
      message: `Une tentative de réinitialisation du mot de passe pour un abonné désactivé.
      Informations de débogage :
      Username demandé : ${subscriber.username}`,
    });
    throw new ErrorHandler(
      401,
      "L'abonné est désactivé, vous ne pouvez pas changer son mot de passe."
    );
  }

  // Hash the password
  const salt = await bcrypt.genSalt();
  const hashedPassword = await bcrypt.hash(password, salt);

  await prisma.aps2024_subscriber.update({
    where: {
      id_subscriber: subscriberId,
    },
    data: {
      password: hashedPassword,
      modified_by: modifiedby,
      modified_date: new Date(),
    },
  });

  return subscriber.username;
};

export const unblockSubscriber = async (userdata, logData) => {
  const { subscriberId, unblockedBy } = userdata;

  const subscriber = await prisma.aps2024_subscriber.findUnique({
    where: {
      id_subscriber: subscriberId,
    },
  });

  if (!subscriber) {
    logger.error({
      ...logData,
      message: `Une tentative de déblocage du compte d'un abonné inexistant.
      Informations de débogage :
      ID de l'abonné demandé : ${subscriberId}`,
    });
    throw new ErrorHandler(401, "Abonné inexistant.");
  }

  await prisma.aps2024_subscriber.update({
    where: {
      id_subscriber: subscriberId,
    },
    data: {
      state: 1,
      login_attempts: 0,
      block_code: null,
      unblocked_by: unblockedBy,
      unblocked_date: new Date(),
    },
  });

  return subscriber.username;
};

export const blockSubscriber = async (userdata, logData) => {
  const { subscriberId, blockCode } = userdata;

  const subscriber = await prisma.aps2024_subscriber.findUnique({
    where: {
      id_subscriber: subscriberId,
    },
  });

  if (!subscriber) {
    logger.error({
      ...logData,
      message: `Une tentative de blocage du compte d'un abonné inexistant.
      Informations de débogage :
      ID de l'abonné demandé : ${subscriberId}`,
    });
    throw new ErrorHandler(401, "Abonné inexistant.");
  }

  await prisma.aps2024_subscriber.update({
    where: {
      id_subscriber: subscriberId,
    },
    data: {
      state: 2,
      block_code: blockCode,
      blocked_date: new Date(),
    },
  });

  return subscriber.username;
};

export const activateSubscriber = async (userdata, logData) => {
  const { subscriberId, type, changeBy } = userdata;
  var updateData = {};

  const subscriber = await prisma.aps2024_subscriber.findUnique({
    where: {
      id_subscriber: subscriberId,
    },
  });

  if (!subscriber) {
    logger.error({
      ...logData,
      message: `Une tentative de ${
        type ? "l'activation" : "la désactivation"
      } du compte d'un abonné inexistant.
      Informations de débogage :
      ID de l'abonné demandé : ${subscriberId}`,
    });
    throw new ErrorHandler(401, "Abonné inexistant.");
  }

  if (type) {
    updateData = {
      state: 1,
      activate_by: changeBy,
      activate_date: new Date(),
    };
  } else {
    updateData = {
      state: 0,
      deactivated_by: changeBy,
      desactivate_date: new Date(),
    };
  }

  await prisma.aps2024_subscriber.update({
    where: {
      id_subscriber: subscriberId,
    },
    data: updateData,
  });

  return subscriber.username;
};

export const updateSubscriber = async (userdata, logData) => {
  const { subscriberId, email, modifiedby } = userdata;

  const subscriber = await prisma.aps2024_subscriber.findUnique({
    where: {
      id_subscriber: subscriberId,
    },
  });

  if (!subscriber) {
    logger.error({
      ...logData,
      message: `Une tentative de modification des informations du compte d'un abonné inexistant.
      Informations de débogage :
      ID de l'abonné demandé : ${subscriberId}`,
    });
    throw new ErrorHandler(401, "Abonné inexistant.");
  }

  if (subscriber.state === 0) {
    logger.error({
      ...logData,
      message: `Une tentative de modification des informations du compte d'un abonné désactivé.
      Informations de débogage :
      Nom d'abonné demandé : ${subscriber.username}`,
    });
    throw new ErrorHandler(
      401,
      "L'abonné est désactivé, vous ne pouvez pas modifier ses informations de compte."
    );
  }

  if (email) {
    const existingEmail = await prisma.aps2024_subscriber.findUnique({
      where: { email: email },
    });
    if (existingEmail) {
      logger.error({
        ...logData,
        message: `Une tentative de modifier l'email du ${subscriber.username} avec un email déjà prise.
        Informations de débogage :
        Email demandé : ${email}`,
      });
      throw new ErrorHandler(401, "L'email est déjà utilisée.");
    }
  }

  delete userdata.subscriberId;

  await prisma.aps2024_subscriber.update({
    where: {
      id_subscriber: subscriberId,
    },
    data: {
      ...userdata,
      modified_by: modifiedby,
      modified_date: new Date(),
    },
  });

  return subscriber.username;
};
