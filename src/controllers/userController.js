import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { ValidationError } from "../middlewares/errorMiddleware.js";
import { spawn } from "child_process";
import {
  createUser,
  getAllUsers,
  getOneUser,
  resetUserPassword,
  changeUserPassword,
  unblockUser,
  updateUser,
  addRoleToUser,
  removeRolesFromUser,
  activateUser,
  getOtherRolesOfUser,
  getAllMenu,
  blockUser,
  changeStateConfiguration,
  getAllConfigurations,
  updateLogedUser,
  getAllForbidenWords,
  createForbiddenWords,
  deleteForbiddenWords,
} from "../services/userService.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";
import { tryCatch } from "../utils/tryCatch.js";
import {
  blockSchema,
  changeStateSchema,
  confIdSchema,
  createForbiddenWordsSchema,
  deleteForbiddenWordsSchema,
  getUserSchema,
  resetPasswordSchema,
  updateloggedUserSchema,
  updatePasswordSchema,
  updateUserSchema,
  userIdSchema,
  userRolesRemoveSchema,
  userRolesSchema,
  userSchema,
} from "../validations/userValidation.js";
import { blockMessage } from "../utils/blockMessage.js";
import { logout, logoutOtherUser } from "../services/authService.js";
import { sendEmail } from "../helpers/authHelper.js";
import analyticsService from "../helpers/analyticsHelper.js";
const logger = infoLogger("utilisateurs");

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
export const GetAllUsers = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = getUserSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const data = await getAllUsers(req.body, req.user);

  return res.status(200).json({
    success: true,
    message: "users Successfully fetched",
    data,
  });
});

export const GetOneUser = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = userIdSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const data = await getOneUser(req.body);

  return res.status(200).json({
    success: true,
    message: "user Successfully fetched",
    data,
  });
});

export const GetOtherRolesOfUser = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = userIdSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const data = await getOtherRolesOfUser(req.body, req.user);

  return res.status(200).json({
    success: true,
    message: "other roles Successfully fetched",
    data,
  });
});

export const CreateUser = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = userSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the signUp service function to create a new user
  const data = await createUser(
    {
      ...req.body,
      assignedby: req.session.username,
    },
    customLog(req, { action: "creation" }),
    req.user
  );

  logger.info(
    customLog(req, {
      message: `L'utilisateur "${data.username}/${
        data.email
      }" a été créé avec les roles suivants : ${data.roles.map(
        (name) => name
      )}`,
      action: "creation",
    })
  );

  return res.status(201).json({
    success: true,
    message: "Un utilisateur créé avec succès.",
    data,
  });
});

export const ResetUserPassword = tryCatch(async (req, res) => {
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

  // Call the signUp service function to create a new user
  const username = await resetUserPassword(
    {
      ...req.body,
      modifiedby: req.session.username,
    },
    customLog(req, { action: "modification" })
  );

  logger.info(
    customLog(req, {
      message: `Le mot de passe de l'utilisateur "${username}" a été réinitialisé.`,
      action: "modification",
    })
  );

  // logout other users
  await logoutOtherUser(req.body);

  return res.status(201).json({
    success: true,
    message: "Mot de passe de l'utilisateur a été réinitialisé avec succès.",
  });
});

export const ChangeUserPassword = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = updatePasswordSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the changeUserPassword service function to create a new user
  await changeUserPassword(
    { ...req.body, modifiedby: req.session.username },
    customLog(req, { action: "modification" })
  );

  logger.info(
    customLog(req, {
      message: `L'utilisateur a changé son mot de passe avec succès.`,
      action: "modification",
    })
  );

  return res.status(201).json({
    success: true,
    message: "Mot de passe a été changé avec succès.",
  });
});

export const BlockUser = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = blockSchema.validate(req.body);

  if (error) {
    throw new ErrorHandler(400, "Input validation error ");
  }

  const username = await blockUser(
    req.body,
    customLog(req, { action: "blocage" })
  );

  logger.info(
    customLog(req, {
      message: `Le compte de l'utilisateur "${username}" a été bloqué ${
        blockMessage[req.body.blockCode].log
      } `,
      action: "blocage",
    })
  );

  await sendEmail(
    `Le compte de l'utilisateur "${username}" a été bloqué ${
      blockMessage[req.body.blockCode].log
    } `
  );

  // logout other users
  await logoutOtherUser(req.body);

  return res.status(201).json({
    success: true,
    message: blockMessage[req.body.blockCode].message,
  });
});

//extraire la partie @ ipv4 d'une @ ipv6
export function ipv6ToIpv4(ipv6) {
  if (ipv6.includes("::ffff:")) {
    const ipv4Part = ipv6.split("::ffff:")[1];
    return ipv4Part;
  } else {
    return ipv6;
  }
}

export const BlockIpAdress = tryCatch(async (req, res) => {
  const ip = req.header("x-forwarded-for") || req.connection.remoteAddress;
  const ipAddress = ipv6ToIpv4(ip);

  const child = spawn("/home/block_ip.sh", [ipAddress]);

  child.stderr.on("data", (data) => {
    console.error(`stderr: ${data}`);
  });

  child.on("error", (error) => {
    console.error(`error: ${error.message}`);
  });

  child.on("close", (code) => {
    if (code === 0) {
      console.log(`IP ${ipAddress} has been blocked\n`);
    } else {
      console.log(`Failed to block IP ${ipAddress}\n`);
    }
  });

  res.json({ success: true, message: `IP ${ipAddress} blocking in progress` });
});

export const UnblockUser = tryCatch(async (req, res) => {
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

  const username = await unblockUser(
    {
      ...req.body,
      unblockedBy: req.session.username,
    },
    customLog(req, { action: "deblocage" })
  );

  logger.info(
    customLog(req, {
      message: `Le compte de l'utilisateur "${username}" a été débloqué.`,
      action: "deblocage",
    })
  );

  return res.status(201).json({
    success: true,
    message: "Le déblocage de l'utilisateur a été effectué avec succés.",
  });
});

export const ActivateUser = tryCatch(async (req, res) => {
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
  const username = await activateUser(
    {
      ...req.body,
      changeBy: req.session.username,
    },
    customLog(req, { action: action })
  );

  logger.info(
    customLog(req, {
      message: `${action} du compte utilisateur suivant : "${username}"`,
      action: action,
    })
  );
  // logout other users
  await logoutOtherUser(req.body);

  return res.status(201).json({
    success: true,
    message: `L'utilisateur a été ${
      req.body.type ? "activé" : "désactivé"
    } avec succès.`,
  });
});

export const UpdateUser = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = updateUserSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const username = await updateUser(
    {
      ...req.body,
      modified_by: req.session.username,
    },
    customLog(req, { action: "modification" }),
    req.user
  );

  logger.info(
    customLog(req, {
      message: `Les informations de l'utilisateur "${username}" ont été modifiés avec succés `,
      action: "modification",
    })
  );

  return res.status(201).json({
    success: true,
    message: "Les informations de l'utilisateur ont été modifié avec succés.",
  });
});

export const UpdateLoggedUser = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = updateloggedUserSchema.validate(req.body);

  console.log(req.session.username);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const username = await updateLogedUser(
    {
      ...req.body,
      id_user: req.session.userId,
      modified_by: req.session.username,
    },
    customLog(req, { action: "modification" }),
    req.user
  );

  logger.info(
    customLog(req, {
      message: `Les informations de l'utilisateur "${username}" ont été modifiés avec succés `,
      action: "modification",
    })
  );

  return res.status(200).json({
    success: true,
    message: "Les informations de l'utilisateur ont été modifié avec succés.",
  });
});

export const AddRoleToUser = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = userRolesSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const { roleName, username } = await addRoleToUser(
    {
      ...req.body,
      assignedBy: req.session.username,
    },
    customLog(req, { action: "attribuer role/utlisateur" }),
    req.user
  );

  logger.info(
    customLog(req, {
      message: `Les roles [ ${roleName.map(
        (name) => name
      )} ] ont été attribués à l'utilisateur ${username} avec succés `,
      action: "attribuer role/utlisateur",
    })
  );

  return res.status(201).json({
    success: true,
    message: "Les roles ont été attribués à l'utilisateur avec succès.",
  });
});

export const RemoveRolesFromUser = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = userRolesRemoveSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const { rolename, username } = await removeRolesFromUser(
    req.body,
    customLog(req, { action: "retirer role/utlisateur" }),
    req.user
  );

  logger.info(
    customLog(req, {
      message: `Le role "${rolename}" a été retiré du utilisateur "${username}" avec succés.`,
      action: "retirer role/utlisateur",
    })
  );

  return res.status(201).json({
    success: true,
    message: "Un role a été retiré d'utilsateur avec succés.",
  });
});

export const GetAllMenu = tryCatch(async (req, res) => {
  const data = await getAllMenu(req.user);

  return res.status(200).json({
    success: true,
    message: "Menu Successfully fetched",
    data,
  });
});

export const GetAllConfigurations = tryCatch(async (req, res) => {
  const data = await getAllConfigurations();

  return res.status(200).json({
    success: true,
    message: "configs Successfully fetched",
    data,
  });
});

export const ChangeStateConfiguration = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = confIdSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Change the state of the dossier and retrieve its name and new state
  const { name, is_active } = await changeStateConfiguration(
    {
      ...req.body,
      actionBy: req.session.username,
    },
    customLog(req)
  );

  // Log dossier state change
  logger.info(
    customLog(req, {
      message: `La config : "${name}" a été ${
        is_active ? "activer" : "désactiver"
      } avec succés.`,
      action: `${is_active ? "activation" : "désactivation"}`,
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "L'état du configuration a été modifié avec succés.",
  });
});

export const GetDashboardStats = tryCatch(async (req, res) => {
  const data = await analyticsService.getDashboardStats();

  return res.status(200).json({
    success: true,
    message: "Stats Successfully fetched",
    data,
  });
});

export const GetAllForbidenWords = tryCatch(async (req, res) => {
  const data = await getAllForbidenWords();

  return res.status(200).json({
    success: true,
    message: "Forbiden Words Successfully fetched",
    data,
  });
});

export const CreateForbiddenWords = tryCatch(async (req, res) => {
  // Validate request body
  const { error } = createForbiddenWordsSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  await createForbiddenWords({
    ...req.body,
    created_by: "oussama",
  });

  return res.status(201).json({
    success: true,
    message: "Forbidden words successfully created",
  });
});

export const DeleteForbiddenWords = tryCatch(async (req, res) => {
  // Validate request body
  const { error } = deleteForbiddenWordsSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  await deleteForbiddenWords(req.body);

  return res.status(200).json({
    success: true,
    message: "Forbidden words successfully deleted",
  });
});
