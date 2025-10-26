import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { ValidationError } from "../middlewares/errorMiddleware.js";
import {
  addPrivilageToRole,
  addUsersToRole,
  createRole,
  deleteRole,
  getAllPrivilages,
  getAllRoles,
  getOneRole,
  getOtherPrivilages,
  getUsersOfRole,
  getUsersWithOtherRoles,
  removePrivilageFromRole,
  removeUsersFromRole,
  updateRole,
} from "../services/roleService.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";
import { tryCatch } from "../utils/tryCatch.js";
import {
  roleIdSchema,
  rolePrivilageRemoveSchema,
  rolePrivilagesSchema,
  roleSchema,
  roleUpdateSchema,
  roleUserRemoveSchema,
  roleUsersSchema,
} from "../validations/roleValidation.js";

const logger = infoLogger("rôles");
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
// Controller function for creating a new role
export const CreateRole = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = roleSchema.validate({
    ...req.body,
  });

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the createRole service function to create a new role
  const { privilagesName, roleId } = await createRole(
    {
      ...req.body,
      createdBy: req.session.username,
    },
    customLog(req, { action: "creation" })
  );

  logger.info(
    customLog(req, {
      message: `Le role "${
        req.body.name
      }" a été créé avec les privilèges suivants : ${privilagesName.map(
        (name) => name
      )}`,
      action: "creation",
    })
  );

  return res.status(201).json({
    success: true,
    message: "Un role créé avec succès.",
    data: roleId,
  });
});

// Controller function for creating a new role
export const GetAllRoles = tryCatch(async (req, res) => {
  const data = await getAllRoles(req.user);

  return res.status(200).json({
    success: true,
    message: "roles Successfully fetched",
    data,
  });
});

export const GetAllPrivilages = tryCatch(async (req, res) => {
  const data = await getAllPrivilages(req.session.userId);

  return res.status(200).json({
    success: true,
    message: "Privilages Successfully fetched",
    data,
  });
});

export const GetOneRole = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = roleIdSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const data = await getOneRole(req.body);

  return res.status(200).json({
    success: true,
    message: "role Successfully fetched",
    data,
  });
});

export const GetOtherPrivilages = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = roleIdSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const data = await getOtherPrivilages(req.body);

  return res.status(200).json({
    success: true,
    message: "Privilages Successfully fetched",
    data,
  });
});

export const GetUsersOfRole = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = roleIdSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const data = await getUsersOfRole(req.body);

  return res.status(200).json({
    success: true,
    message: "users Successfully fetched",
    data,
  });
});

export const GetUsersWithOtherRoles = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = roleIdSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const data = await getUsersWithOtherRoles(req.body);

  return res.status(200).json({
    success: true,
    message: "users Successfully fetched",
    data,
  });
});

export const UpdateRole = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = roleUpdateSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const roleName = await updateRole(
    {
      ...req.body,
      modifiedBy: req.session.username,
    },
    customLog(req, { action: "modification" }),
    req.user
  );

  logger.info(
    customLog(req, {
      message: `le role "${roleName}" a été modifié avec succés.`,
      action: "modification",
    })
  );

  return res.status(200).json({
    success: true,
    message: "Le role modifié avec succés.",
  });
});

export const DeleteRole = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = roleIdSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const roleName = await deleteRole(
    req.body,
    customLog(req, { action: "suppression" }),
    req.user
  );

  logger.info(
    customLog(req, {
      message: `le role "${roleName}" a été supprimé avec succés.`,
      action: "suppression",
    })
  );

  return res.status(200).json({
    success: true,
    message: "Le role supprimé avec succés.",
  });
});

export const AddPrivilageToRole = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = rolePrivilagesSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const { roleName, privilagesName } = await addPrivilageToRole(
    req.body,
    customLog(req, { action: "attribuer privilèges/role" }),
    req.user
  );

  logger.info(
    customLog(req, {
      message: `Les privilèges "${privilagesName.map(
        (name) => name
      )}" ont été attribués au role "${roleName}" avec succés.`,
      action: "attribuer privilèges/role",
    })
  );

  return res.status(200).json({
    success: true,
    message: "Privilèges ajouté au role avec succès",
  });
});

export const RemovePrivilageFromRole = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = rolePrivilageRemoveSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const { privilagesName, roleName } = await removePrivilageFromRole(
    req.body,
    customLog(req, { action: "retirer privilèges/role" }),
    req.user
  );

  logger.info(
    customLog(req, {
      message: `Le privilège "${privilagesName}" a été retiré du role "${roleName}" avec succés.`,
      action: "retirer privilèges/role",
    })
  );

  return res.status(200).json({
    success: true,
    message: "Un privilège a été retiré du role avec succés.",
  });
});

export const AddUsersToRole = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = roleUsersSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const { roleName, usersName } = await addUsersToRole(
    { ...req.body, assignedBy: req.session.username },
    customLog(req, { action: "attribuer utilisateurs/role" }),
    req.user
  );

  logger.info(
    customLog(req, {
      message: `Le role "${roleName}" a été attribué aux utilisateurs" ${usersName.map(
        (user) =>
          `[ID : ${user.userId}, nom d'utilisateur : ${user.username}] avec succés.`
      )}`,
      action: "attribuer utilisateurs/role",
    })
  );

  return res.status(200).json({
    success: true,
    message: "Le role a été attribué aux utilisateurs avec succés.",
  });
});

export const RemoveUsersFromRole = tryCatch(async (req, res) => {
  // Validate the request body
  const { error } = roleUserRemoveSchema.validate(req.body);

  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  const { roleName, username } = await removeUsersFromRole(
    req.body,
    customLog(req, { action: "retirer utilisateurs/role" }),
    req.user
  );

  logger.info(
    customLog(req, {
      message: `Le role "${roleName}" a été retiré de l'utilisateur 
        [ID : ${req.body.userId}, nom d'utilisateur : ${username}] avec succés.
      `,
      action: "retirer utilisateurs/role",
    })
  );

  return res.status(200).json({
    success: true,
    message: "Le role a été retiré de l'utilisateur avec succés.",
  });
});
