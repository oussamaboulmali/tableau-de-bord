import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { ValidationError } from "../middlewares/errorMiddleware.js";
import {
  createSubscriber,
  getAllSubscriber,
  getOneSubscriber,
  resetSubscriberPassword,
  unblockSubscriber,
  updateSubscriber,
  activateSubscriber,
  blockSubscriber,
} from "../services/subscriberService.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";
import { tryCatch } from "../utils/tryCatch.js";
import {
  blockSchema,
  changeStateSchema,
  resetPasswordSchema,
  updateSubscriberSchema,
  subscriberIdSchema,
  subscriberSchema,
} from "../validations/subscriberValidation.js";
import { blockMessage } from "../utils/blockMessage.js";
import { sendEmail } from "../helpers/authHelper.js";
const logger = infoLogger("abonne");

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
export const GetAllSubscriber = tryCatch(async (req, res) => {
  const data = await getAllSubscriber();

  return res.status(200).json({
    success: true,
    message: "Subscribers Successfully fetched",
    data,
  });
});

export const GetOneSubscriber = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = subscriberIdSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const data = await getOneSubscriber(req.body);

  return res.status(200).json({
    success: true,
    message: "Subscriber Successfully fetched",
    data,
  });
});

export const CreateSubscriber = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = subscriberSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the signUp service function to create a new Subscriber
  const data = await createSubscriber(
    {
      ...req.body,
      id_user: req.session.userId,
      assignedby: req.session.username,
    },
    customLog(req, { action: "creation" })
  );

  logger.info(
    customLog(req, {
      message: `L'abonné "${data.username}/${data.email}" a été créé avec succès`,
      action: "creation",
    })
  );

  return res.status(201).json({
    success: true,
    message: "L'abonné créé avec succès.",
    data,
  });
});

export const ResetSubscriberPassword = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = resetPasswordSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the signUp service function to create a new Subscriber
  const username = await resetSubscriberPassword(
    {
      ...req.body,
      modifiedby: req.session.username,
    },
    customLog(req, { action: "modification" })
  );

  logger.info(
    customLog(req, {
      message: `Le mot de passe de l'abonné "${username}" a été réinitialisé.`,
      action: "modification",
    })
  );

  return res.status(200).json({
    success: true,
    message: "Mot de passe de l'abonné a été réinitialisé avec succès.",
  });
});

export const BlockSubscriber = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = blockSchema.validate(req.body);

  if (error) {
    throw new ErrorHandler(400, "Input validation error ");
  }

  const username = await blockSubscriber(
    req.body,
    customLog(req, { action: "blocage" })
  );

  logger.info(
    customLog(req, {
      message: `Le compte de l'abonné "${username}" a été bloqué ${
        blockMessage[req.body.blockCode].log
      } `,
      action: "blocage",
    })
  );

  await sendEmail(
    `Le compte de l'abonné "${username}" a été bloqué ${
      blockMessage[req.body.blockCode].log
    } `
  );

  return res.status(200).json({
    success: true,
    message: blockMessage[req.body.blockCode].message,
  });
});

export const UnblockSubscriber = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = changeStateSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const username = await unblockSubscriber(
    {
      ...req.body,
      unblockedBy: req.session.username,
    },
    customLog(req, { action: "deblocage" })
  );

  logger.info(
    customLog(req, {
      message: `Le compte de l'abonné "${username}" a été débloqué.`,
      action: "deblocage",
    })
  );

  return res.status(200).json({
    success: true,
    message: "Le déblocage de l'abonné a été effectué avec succés.",
  });
});

export const ActivateSubscriber = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = changeStateSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }
  const action = req.body.type ? "activation" : "desactivation";
  const username = await activateSubscriber(
    {
      ...req.body,
      changeBy: req.session.username,
    },
    customLog(req, { action: action })
  );

  logger.info(
    customLog(req, {
      message: `${action} du compte abonné suivant : "${username}"`,
      action: action,
    })
  );

  return res.status(200).json({
    success: true,
    message: `L'abonné a été ${
      req.body.type ? "activé" : "désactivé"
    } avec succès.`,
  });
});

export const UpdateSubscriber = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = updateSubscriberSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const username = await updateSubscriber(
    {
      ...req.body,
      modified_by: req.session.username,
    },
    customLog(req, { action: "modification" })
  );

  logger.info(
    customLog(req, {
      message: `Les informations de l'abonné "${username}" ont été modifiés avec succés `,
      action: "modification",
    })
  );

  return res.status(200).json({
    success: true,
    message: "Les informations de l'abonné ont été modifié avec succés.",
  });
});
