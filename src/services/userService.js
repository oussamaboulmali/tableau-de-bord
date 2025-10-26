import prisma from "../configs/database.js";
import bcrypt from "bcryptjs";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";
import { getRoleLevel } from "../utils/rolesHierarchy.js";
import forbiddenWordsService from "../helpers/forbiddenWordsHelper.js";

const logger = infoLogger("utilisateurs");

/**
 * Get all users based on state and current user role permissions
 */
export const getAllUsers = async ({ state }, currentUser) => {
  // Determine which users the current user can view based on their role
  let whereCondition = {};

  // Apply state filter if provided
  if (state !== undefined) {
    whereCondition.state = state;
  }

  // Filter based on role permissions
  if (currentUser.activeRoles.includes("SuperUser")) {
    // SuperUser can see all users - no additional filtering
  } else if (currentUser.activeRoles.includes("Admin")) {
    // Admin can see all users - no additional filtering
  } else if (currentUser.activeRoles.includes("Superviseur")) {
    // Superviseur can see all users except Admin and SuperUser roles
    whereCondition.aps2024_user_role = {
      none: {
        aps2024_roles: {
          name: { in: ["Admin", "SuperUser"] },
        },
      },
    };
  } else if (currentUser.activeRoles.includes("Rédacteur en chef")) {
    // "Rédacteur en chef" can only see users with specific roles
    whereCondition.aps2024_user_role = {
      some: {
        aps2024_roles: {
          name: {
            in: [
              "Rédacteur",
              "Infographe",
              "Vidéaste",
              "Photographe",
              "Chef de vacation",
              "Rédacteur en chef",
            ],
          },
        },
      },
    };
  } else {
    // Default case - only see themselves
    whereCondition.aps2024_user_role = {
      some: {
        aps2024_roles: {
          name: {
            in: ["Rédacteur", "Chef de vacation", "Rédacteur en chef"],
          },
        },
      },
    };
  }

  const users = await prisma.aps2024_users.findMany({
    orderBy: {
      id_user: "asc",
    },
    where: whereCondition,
    select: {
      id_user: true,
      username: true,
      first_name: true,
      last_name: true,
      post: true,
      email: true,
      state: true,
      lastvisit_date: true,
      aps2024_user_role: {
        select: {
          aps2024_roles: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  // Format user roles for the response
  const formattedUsers = users.map((user) => {
    const formattedUser = { ...user };
    formattedUser.roles = user.aps2024_user_role.map(
      (ur) => ur.aps2024_roles.name
    );
    delete formattedUser.aps2024_user_role;
    return formattedUser;
  });

  // Sort users by state if no specific state was requested
  if (state === undefined) {
    formattedUsers.sort((a, b) => {
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
  }

  return formattedUsers;
};

export const getOneUser = async ({ userId }) => {
  const user = await prisma.aps2024_users.findUnique({
    where: { id_user: userId },
    include: {
      aps2024_user_role: {
        include: {
          aps2024_roles: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new ErrorHandler(404, "No User found");
  }
  delete user.password;
  delete user.otpkey;
  delete user.otpTime;
  delete user.login_attempts;

  user.roles = user.aps2024_user_role.map((role) => ({
    id_role: role.id_role,
    assigned_date: role.assigned_date,
    assigned_by: role.assigned_by,
    name: role.aps2024_roles.name,
  }));

  delete user.aps2024_user_role;

  return user;
};

/**
 * Get roles that the current user can assign to other users
 */
export const getOtherRolesOfUser = async ({ userId }, currentUser) => {
  // Verify user exists
  const targetUser = await prisma.aps2024_users.findUnique({
    where: {
      id_user: userId,
    },
  });

  if (!targetUser) {
    throw new ErrorHandler(404, "Utilisateur non trouvé");
  }

  // Find roles not already assigned to the target user
  const otherRoles = await prisma.aps2024_roles.findMany({
    where: {
      NOT: {
        aps2024_user_role: {
          some: {
            id_user: userId,
          },
        },
      },
    },
  });

  // Filter by current user's permission to assign roles
  if (currentUser.activeRoles.includes("SuperUser")) {
    // SuperUser can assign all roles
    return otherRoles;
  } else if (currentUser.activeRoles.includes("Admin")) {
    // Admin can assign all roles except SuperUser and Admin
    return otherRoles.filter(
      (role) => role.name !== "SuperUser" && role.name !== "Admin"
    );
  } else if (currentUser.activeRoles.includes("Rédacteur en chef")) {
    // "Rédacteur en chef" can assign lower-level roles except "Rédacteur en chef"
    return otherRoles.filter((role) =>
      [
        "Rédacteur",
        "Infographe",
        "Vidéaste",
        "Photographe",
        "Chef de vacation",
      ].includes(role.name)
    );
  } else {
    // Default - can't assign any roles
    return [];
  }
};

/**
 * Create a new user with role restrictions based on the creator's role
 */
export const createUser = async (userData, logData, currentUser) => {
  const { password, email, username, roles, assignedby } = userData;

  // Check if email is already taken
  const existingEmail = await prisma.aps2024_users.findUnique({
    where: { email: email },
  });
  if (existingEmail) {
    logger.error({
      ...logData,
      message: `Une tentative de créer un nouveau utilisateur avec un email ${email} déjà pris.
      Informations de débogage :
      Email demandé : ${email}`,
    });
    throw new ErrorHandler(401, "Email déjà pris");
  }

  // Check if username is already taken
  const existingUser = await prisma.aps2024_users.findUnique({
    where: { username: username },
  });

  if (existingUser) {
    logger.error({
      ...logData,
      message: `Une tentative de créer un nouveau utilisateur avec un username ${username} déjà pris.
      Informations de débogage :
      Username demandé : ${username}`,
    });
    throw new ErrorHandler(401, "Username déjà pris");
  }

  // Get the new roles details
  const rolesToAssign = [];
  let highestRoleLevel = 0;

  // Check role assignment permissions and collect role information
  for (const roleId of roles) {
    // Check if the role exists
    const roleToAssign = await prisma.aps2024_roles.findUnique({
      where: {
        id_role: roleId,
      },
    });

    if (!roleToAssign) {
      logger.error({
        ...logData,
        message: `Une tentative de création d'un utilisateur avec un role inexistant.
        Informations de débogage :
        ID du role demandé : ${roleId}`,
      });
      throw new ErrorHandler(401, "L'un des roles est inexistant.");
    }

    // Role assignment restrictions
    if (
      currentUser.activeRoles.includes("Admin") &&
      roleToAssign.name === "SuperUser"
    ) {
      logger.error({
        ...logData,
        message: `Un Admin a tenté d'attribuer le rôle SuperUser.
        Informations de débogage :
        ID du role demandé : ${roleId}`,
      });
      throw new ErrorHandler(
        403,
        "Les administrateurs ne peuvent pas attribuer le rôle SuperUser."
      );
    }

    if (
      currentUser.activeRoles.includes("Rédacteur en chef") &&
      roleToAssign.name === "Rédacteur en chef"
    ) {
      logger.error({
        ...logData,
        message: `Un rédacteur en chef a tenté d'attribuer le rôle rédacteur en chef.
        Informations de débogage :
        ID du role demandé : ${roleId}`,
      });
      throw new ErrorHandler(
        403,
        "Les rédacteurs en chef ne peuvent pas attribuer le rôle rédacteur en chef."
      );
    }

    // Get role level
    const roleLevel = getRoleLevel(roleToAssign.name);
    highestRoleLevel = Math.max(highestRoleLevel, roleLevel);

    rolesToAssign.push({
      id: roleId,
      name: roleToAssign.name,
      level: roleLevel,
    });
  }

  // Apply role elevation logic - only keep the roles at the highest level
  const elevatedRoles = rolesToAssign.filter(
    (role) => role.level === highestRoleLevel
  );

  // Hash the password
  const salt = await bcrypt.genSalt();
  const hashedPassword = await bcrypt.hash(password, salt);

  delete userData.roles;
  delete userData.assignedby;

  // Create a new user with only the elevated roles
  const newUser = await prisma.aps2024_users.create({
    data: {
      ...userData,
      password: hashedPassword,
      register_by: assignedby,
      aps2024_user_role: {
        createMany: {
          data: elevatedRoles.map((role) => ({
            id_role: role.id,
            assigned_by: assignedby,
          })),
        },
      },
    },
    include: {
      aps2024_user_role: {
        select: {
          aps2024_roles: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return {
    user_id: newUser.id_user,
    username: newUser.username,
    email: newUser.email,
    roles: newUser.aps2024_user_role.map(
      (roleName) => roleName.aps2024_roles.name
    ),
  };
};

export const resetUserPassword = async (userdata, logData) => {
  const { userId, password, modifiedby } = userdata;

  const user = await prisma.aps2024_users.findUnique({
    where: {
      id_user: userId,
    },
  });

  if (!user) {
    logger.error({
      ...logData,
      message: `Une tentative de réinitialisation du mot de passe pour un utilisateur inexistant.
      Informations de débogage :
      ID de l'utilisateur demandé : ${userId}`,
    });
    throw new ErrorHandler(401, "Utilisateur inexistant.");
  }

  if (user.state === 0) {
    logger.error({
      ...logData,
      message: `Une tentative de réinitialisation du mot de passe pour un utilisateur désactivé.
      Informations de débogage :
      Username demandé : ${user.username}`,
    });
    throw new ErrorHandler(
      401,
      "L'utilisateur est désactivé, vous ne pouvez pas changer son mot de passe."
    );
  }

  // Hash the password
  const salt = await bcrypt.genSalt();
  const hashedPassword = await bcrypt.hash(password, salt);

  await prisma.aps2024_users.update({
    where: {
      id_user: userId,
    },
    data: {
      password: hashedPassword,
      modified_by: modifiedby,
      modified_date: new Date(),
    },
  });

  return user.username;
};

export const changeUserPassword = async (userdata, logData) => {
  const { userId, oldPassword, newPassword, modifiedby } = userdata;

  const user = await prisma.aps2024_users.findUnique({
    where: {
      id_user: userId,
    },
  });

  if (!user) {
    logger.error({
      ...logData,
      message: `Une tentative de changement de son propre mot de passe avec un ID utilisateur incorrect.
      Informations de débogage :
      ID de l'utilisateur demandé : ${userId}`,
    });
    throw new ErrorHandler(401, "Utilisateur inexistant.");
  }

  // Check if the password is correct
  const isCorrectPassword = await bcrypt.compare(oldPassword, user.password);

  if (!isCorrectPassword) {
    logger.error({
      ...logData,
      message: `Une tentative de changement de mot de passe avec un ancien mot de passe incorrect.`,
    });
    throw new ErrorHandler(
      403,
      "Le mot de passe que vous avez fourni est incorrect."
    );
  }

  // Hash the password
  const salt = await bcrypt.genSalt();
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  await prisma.aps2024_users.update({
    where: {
      id_user: userId,
    },
    data: {
      password: hashedPassword,
      modified_by: modifiedby,
      modified_date: new Date(),
    },
  });
};

export const unblockUser = async (userdata, logData) => {
  const { userId, unblockedBy } = userdata;

  const user = await prisma.aps2024_users.findUnique({
    where: {
      id_user: userId,
    },
  });

  if (!user) {
    logger.error({
      ...logData,
      message: `Une tentative de déblocage du compte d'un utilisateur inexistant.
      Informations de débogage :
      ID de l'utilisateur demandé : ${userId}`,
    });
    throw new ErrorHandler(401, "Utilisateur inexistant.");
  }

  await prisma.aps2024_users.update({
    where: {
      id_user: userId,
    },
    data: {
      state: 1,
      login_attempts: 0,
      block_code: null,
      unblocked_by: unblockedBy,
      unblocked_date: new Date(),
    },
  });

  return user.username;
};

export const blockUser = async (userdata, logData) => {
  const { userId, blockCode } = userdata;

  const user = await prisma.aps2024_users.findUnique({
    where: {
      id_user: userId,
    },
  });

  if (!user) {
    logger.error({
      ...logData,
      message: `Une tentative de blocage du compte d'un utilisateur inexistant.
      Informations de débogage :
      ID de l'utilisateur demandé : ${userId}`,
    });
    throw new ErrorHandler(401, "Utilisateur inexistant.");
  }

  await prisma.aps2024_users.update({
    where: {
      id_user: userId,
    },
    data: {
      state: 2,
      block_code: blockCode,
      blocked_date: new Date(),
    },
  });

  return user.username;
};

export const activateUser = async (userdata, logData) => {
  const { userId, type, changeBy } = userdata;
  var updateData = {};

  const user = await prisma.aps2024_users.findUnique({
    where: {
      id_user: userId,
    },
  });

  if (!user) {
    logger.error({
      ...logData,
      message: `Une tentative de ${
        type ? "l'activation" : "la désactivation"
      } du compte d'un utilisateur inexistant.
      Informations de débogage :
      ID de l'utilisateur demandé : ${userId}`,
    });
    throw new ErrorHandler(401, "Utilisateur inexistant.");
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

  await prisma.aps2024_users.update({
    where: {
      id_user: userId,
    },
    data: updateData,
  });

  return user.username;
};

/**
 * Update user information with role-based restrictions
 */
export const updateUser = async (userdata, logData, currentUser) => {
  const { userId, email, modifiedby } = userdata;

  const targetUser = await prisma.aps2024_users.findUnique({
    where: {
      id_user: userId,
    },
    include: {
      aps2024_user_role: {
        include: {
          aps2024_roles: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!targetUser) {
    logger.error({
      ...logData,
      message: `Une tentative de modification des informations du compte d'un utilisateur inexistant.
      Informations de débogage :
      ID de l'utilisateur demandé : ${userId}`,
    });
    throw new ErrorHandler(404, "Utilisateur inexistant.");
  }

  // Check if target user is SuperUser and current user is Admin
  const targetUserRoles = targetUser.aps2024_user_role.map(
    (role) => role.aps2024_roles.name
  );

  if (
    targetUserRoles.includes("SuperUser") &&
    currentUser.activeRoles.includes("Admin")
  ) {
    logger.error({
      ...logData,
      message: `Un Admin a tenté de modifier un SuperUser.
      Informations de débogage :
      ID de l'utilisateur ciblé : ${userId}`,
    });
    throw new ErrorHandler(
      403,
      "Les administrateurs ne peuvent pas modifier les superUsers."
    );
  }

  if (targetUser.state === 0) {
    logger.error({
      ...logData,
      message: `Une tentative de modification des informations du compte d'un utilisateur désactivé.
      Informations de débogage :
      Nom d'utilisateur demandé : ${targetUser.username}`,
    });
    throw new ErrorHandler(
      401,
      "L'utilisateur est désactivé, vous ne pouvez pas modifier ses informations de compte."
    );
  }

  if (email) {
    const existingEmail = await prisma.aps2024_users.findUnique({
      where: {
        email: email,
        NOT: {
          id_user: userId,
        },
      },
    });

    if (existingEmail) {
      logger.error({
        ...logData,
        message: `Une tentative de modifier l'email du ${targetUser.username} avec un email déjà prise.
        Informations de débogage :
        Email demandé : ${email}`,
      });
      throw new ErrorHandler(401, "L'email est déjà utilisée.");
    }
  }

  delete userdata.userId;

  await prisma.aps2024_users.update({
    where: {
      id_user: userId,
    },
    data: {
      ...userdata,
      modified_by: modifiedby,
      modified_date: new Date(),
    },
  });

  return targetUser.username;
};

/**
 * Update user information with role-based restrictions
 */
export const updateLogedUser = async (userdata, logData) => {
  const { id_user, email } = userdata;

  const targetUser = await prisma.aps2024_users.findUnique({
    where: {
      id_user: id_user,
    },
    include: {
      aps2024_user_role: {
        include: {
          aps2024_roles: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!targetUser) {
    logger.error({
      ...logData,
      message: `Une tentative de modification des informations du compte d'un utilisateur inexistant.
      Informations de débogage :
      ID de l'utilisateur demandé : ${id_user}`,
    });
    throw new ErrorHandler(404, "Utilisateur inexistant.");
  }

  if (targetUser.state === 0) {
    logger.error({
      ...logData,
      message: `Une tentative de modification des informations du compte d'un utilisateur désactivé.
      Informations de débogage :
      Nom d'utilisateur demandé : ${targetUser.username}`,
    });
    throw new ErrorHandler(
      401,
      "L'utilisateur est désactivé, vous ne pouvez pas modifier ses informations de compte."
    );
  }

  if (email) {
    const existingEmail = await prisma.aps2024_users.findUnique({
      where: {
        email: email,
        NOT: {
          id_user: id_user,
        },
      },
    });

    if (existingEmail) {
      logger.error({
        ...logData,
        message: `Une tentative de modifier l'email du ${targetUser.username} avec un email déjà prise.
        Informations de débogage :
        Email demandé : ${email}`,
      });
      throw new ErrorHandler(401, "L'email est déjà utilisée.");
    }
  }

  await prisma.aps2024_users.update({
    where: {
      id_user: id_user,
    },
    data: {
      ...userdata,
      modified_date: new Date(),
    },
  });

  return targetUser.username;
};
/**
 * Add roles to a user with role-based restrictions
 */
export const addRoleToUser = async (data, logData, currentUser) => {
  const { userId, roles, assignedBy } = data;
  const roleName = [];

  const existingUser = await prisma.aps2024_users.findUnique({
    where: { id_user: userId },
    include: {
      aps2024_user_role: {
        include: {
          aps2024_roles: {
            select: {
              id_role: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!existingUser) {
    logger.error({
      ...logData,
      message: `Une tentative d'ajout des roles à un utilisateur inexistant.
      Informations de débogage :
      ID de l'utilisateur demandé : ${userId}`,
    });
    throw new ErrorHandler(404, "Utilisateur inexistant.");
  }

  // Check if target user is SuperUser and current user is Admin
  const targetUserRoles = existingUser.aps2024_user_role.map(
    (role) => role.aps2024_roles.name
  );

  if (
    targetUserRoles.includes("SuperUser") &&
    currentUser.activeRoles.includes("Admin")
  ) {
    logger.error({
      ...logData,
      message: `Un Admin a tenté de modifier les rôles d'un SuperUser.
      Informations de débogage :
      ID de l'utilisateur ciblé : ${userId}`,
    });
    throw new ErrorHandler(
      403,
      "Les administrateurs ne peuvent pas modifier les superUsers."
    );
  }

  if (userId == currentUser.id_user) {
    logger.error({
      ...logData,
      message: `Une tentative de se rajouter des roles.
      Informations de débogage :
      Nom d'utilisateur demandé : ${existingUser.username}`,
    });
    throw new ErrorHandler(401, "Vous ne pouvez pas vous ajouter des roles.");
  }

  if (existingUser.state === 0) {
    logger.error({
      ...logData,
      message: `Une tentative d'ajout des roles à un utilisateur désactivé.
      Informations de débogage :
      Nom d'utilisateur demandé : ${existingUser.username}`,
    });
    throw new ErrorHandler(
      401,
      "L'utilisateur est désactivé, vous ne pouvez pas lui attribuer des roles."
    );
  }

  // Get the new roles being added
  const newRolesToAdd = [];
  const newRoleNames = [];

  // First, validate all the roles to be added
  for (const roleId of roles) {
    const roleToAssign = await prisma.aps2024_roles.findUnique({
      where: {
        id_role: roleId,
      },
    });

    if (!roleToAssign) {
      logger.error({
        ...logData,
        message: `Une tentative d'ajout d'un role inexistant à ${existingUser.username}.
        Informations de débogage :
        ID du role demandé : ${roleId}`,
      });
      throw new ErrorHandler(401, "Un des roles est inexistant");
    }

    // Role assignment restrictions
    if (
      currentUser.activeRoles.includes("Admin") &&
      roleToAssign.name === "SuperUser"
    ) {
      logger.error({
        ...logData,
        message: `Un Admin a tenté d'attribuer le rôle SuperUser.
        Informations de débogage :
        ID du role demandé : ${roleId}`,
      });
      throw new ErrorHandler(
        403,
        "Les administrateurs ne peuvent pas attribuer le rôle SuperUser."
      );
    }

    if (
      currentUser.activeRoles.includes("Rédacteur en chef") &&
      roleToAssign.name === "Rédacteur en chef"
    ) {
      logger.error({
        ...logData,
        message: `Un rédacteur en chef a tenté d'attribuer le rôle rédacteur en chef.
        Informations de débogage :
        ID du role demandé : ${roleId}`,
      });
      throw new ErrorHandler(
        403,
        "Les rédacteurs en chef ne peuvent pas attribuer le rôle rédacteur en chef."
      );
    }

    // Add to our collection of new roles
    newRolesToAdd.push({
      id: roleId,
      name: roleToAssign.name,
      level: getRoleLevel(roleToAssign.name),
    });
    newRoleNames.push(roleToAssign.name);
  }

  // If no valid roles to add, we're done
  if (newRolesToAdd.length === 0) {
    return {
      username: existingUser.username,
      roleName: [],
    };
  }

  // Get the highest role level being added
  const highestNewRoleLevel = Math.max(...newRolesToAdd.map((r) => r.level));
  // Get existing user roles
  const existingRoles = existingUser.aps2024_user_role.map((ur) => ({
    id: ur.aps2024_roles.id_role,
    name: ur.aps2024_roles.name,
    level: getRoleLevel(ur.aps2024_roles.name),
  }));

  // Get the highest existing role level
  const highestExistingRoleLevel =
    existingRoles.length > 0
      ? Math.max(...existingRoles.map((r) => r.level))
      : 0;

  // Determine which roles to keep and which to remove
  const rolesToDelete = [];
  const rolesToKeep = [];

  if (highestNewRoleLevel > highestExistingRoleLevel) {
    // If new role is higher, remove all lower roles
    existingRoles.forEach((role) => {
      if (role.level < highestNewRoleLevel) {
        rolesToDelete.push(role.id);
      } else {
        rolesToKeep.push(role);
      }
    });
  } else {
    // If new role is equal or lower, check each individually
    existingRoles.forEach((role) => {
      // Check if this existing role is already higher than any of the new roles
      if (role.level >= highestNewRoleLevel) {
        rolesToKeep.push(role);
      } else {
        rolesToDelete.push(role.id);
      }
    });
  }

  // Filter out roles that are already assigned
  const rolesToAdd = newRolesToAdd.filter(
    (newRole) =>
      !rolesToKeep.some((existingRole) => existingRole.id === newRole.id)
  );

  // If there are roles to delete
  if (rolesToDelete.length > 0) {
    await prisma.aps2024_user_role.deleteMany({
      where: {
        id_user: userId,
        id_role: {
          in: rolesToDelete,
        },
      },
    });

    logger.info({
      ...logData,
      message: `Roles supprimés pour l'utilisateur ${
        existingUser.username
      } suite à l'élévation de rôle.
      Roles supprimés: ${rolesToDelete.join(", ")}`,
    });
  }

  // If there are roles to add
  if (rolesToAdd.length > 0) {
    // Create user-role relationships for the new roles
    const createdData = rolesToAdd.map((role) => ({
      id_role: role.id,
      id_user: userId,
      assigned_by: assignedBy,
    }));

    await prisma.aps2024_user_role.createMany({
      data: createdData,
    });

    roleName.push(...rolesToAdd.map((role) => role.name));
  }

  return {
    username: existingUser.username,
    roleName,
  };
};

/**
 * Remove a role from a user with role-based restrictions
 */
export const removeRolesFromUser = async (data, logData, currentUser) => {
  const { userId, roleId } = data;

  const existingUser = await prisma.aps2024_users.findUnique({
    where: { id_user: userId },
    include: {
      _count: {
        select: {
          aps2024_user_role: true,
        },
      },
      aps2024_user_role: {
        include: {
          aps2024_roles: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!existingUser) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'un role d'un utilisateur inexistant.
      Informations de débogage :
      ID de l'utilisateur demandé : ${userId}`,
    });
    throw new ErrorHandler(404, "Utilisateur inexistant");
  }

  // Check if target user is SuperUser and current user is Admin
  const targetUserRoles = existingUser.aps2024_user_role.map(
    (role) => role.aps2024_roles.name
  );

  if (
    targetUserRoles.includes("SuperUser") &&
    currentUser.activeRoles.includes("Admin")
  ) {
    logger.error({
      ...logData,
      message: `Un Admin a tenté de modifier les rôles d'un SuperUser.
      Informations de débogage :
      ID de l'utilisateur ciblé : ${userId}`,
    });
    throw new ErrorHandler(
      403,
      "Les administrateurs ne peuvent pas modifier les superUsers."
    );
  }

  if (userId === currentUser.id_user) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression de ses propres roles.
      Informations de débogage :
      Nom d'utilisateur demandé : ${existingUser.username}
      ID du role demandé : ${roleId}`,
    });
    throw new ErrorHandler(
      401,
      "Vous ne pouvez pas vous retirer vos propres roles."
    );
  }

  if (existingUser.state === 0) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'un role d'un utilisateur désactivé.
      Informations de débogage :
      Nom d'utilisateur demandé : ${existingUser.username}`,
    });
    throw new ErrorHandler(
      401,
      "L'utilisateur est désactivé, vous ne pouvez pas lui retirer ses roles."
    );
  }

  // Check if the user has the role
  const existingRoleUser = await prisma.aps2024_user_role.findFirst({
    where: {
      id_role: roleId,
      id_user: userId,
    },
    include: {
      aps2024_roles: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!existingRoleUser) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'un role qu'il ne le possède pas de ${existingUser.username}.
      Informations de débogage :
      ID du role demandé : ${roleId}`,
    });
    throw new ErrorHandler(401, "L'utilisateur ne possède pas ce role.");
  }

  if (existingUser._count.aps2024_user_role == 1) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression du dernier role de l'utilisateur.
      Informations de débogage :
      Nom d'utilisateur demandé : ${existingUser.username}
      Nom du role demandé : ${existingRoleUser.aps2024_roles.name}`,
    });
    throw new ErrorHandler(
      401,
      "Vous ne pouvez pas supprimer le dernier role de cet utilisateur."
    );
  }

  // If the relationship exists, delete it
  await prisma.aps2024_user_role.deleteMany({
    where: {
      id_role: roleId,
      id_user: userId,
    },
  });

  return {
    username: existingUser.username,
    rolename: existingRoleUser.aps2024_roles.name,
  };
};

export const getAllMenu = async (user) => {
  const allMenuItems = [
    {
      id: "Acceuil",
      privilge: null, // No privilege required - always accessible
      children: [
        { id: "acceuil.dashboard", privilge: "acceuil.dashboard" },
        { id: "acceuil.analytics", privilge: "acceuil.analytics" },
        { id: "acceuil.notifications", privilge: "acceuil.notifications" },
        { id: "emergency.view", privilge: "emergency.view" },
        { id: "emergency.create", privilge: "emergency.create" },
        { id: "emergency.edit", privilge: "emergency.edit" },
        { id: "emergency.publish", privilge: "emergency.publish" },
        { id: "categories.default", privilge: "categories.default" },
        { id: "configurations.view", privilge: "configurations.view" },
      ],
    },
    {
      id: "Articles",
      privilge: "articles.view",
      children: [
        { id: "articles.view", privilge: "articles.view" },
        { id: "articles.create", privilge: "articles.create" },
        { id: "articles.edit", privilge: "articles.edit" },
        { id: "articles.delete", privilge: "articles.delete" },
        { id: "articles.trash", privilge: "articles.trash" },
        { id: "articles.publish", privilge: "articles.publish" },
        { id: "articles.schedule", privilge: "articles.schedule" },
        { id: "articles.pin", privilge: "articles.pin" },
      ],
    },
    {
      id: "Media",
      children: [
        {
          id: "videos",
          privilge: "video.view",
          children: [
            { id: "video.view", privilge: "video.view" },
            { id: "video.create", privilge: "video.create" },
            { id: "video.edit", privilge: "video.edit" },
            { id: "video.publish", privilge: "video.publish" },
            { id: "video.pin", privilge: "video.pin" },
            { id: "video.main", privilge: "video.main" },
          ],
        },
        {
          id: "galeries",
          privilge: "gallery.view",
          children: [
            { id: "gallery.view", privilge: "gallery.view" },
            { id: "gallery.create", privilge: "gallery.create" },
            { id: "gallery.edit", privilge: "gallery.edit" },
            { id: "gallery.publish", privilge: "gallery.publish" },
            { id: "gallery.pin", privilge: "gallery.pin" },
          ],
        },
        {
          id: "cahiers",
          privilge: "cahiers.view",
          children: [
            { id: "cahiers.view", privilge: "cahiers.view" },
            { id: "cahiers.create", privilge: "cahiers.create" },
            { id: "cahiers.edit", privilge: "cahiers.edit" },
            { id: "cahiers.publish", privilge: "cahiers.publish" },
          ],
        },
        {
          id: "infographies",
          privilge: "infographics.view",
          children: [
            { id: "infographics.view", privilge: "infographics.view" },
            { id: "infographics.create", privilge: "infographics.create" },
            { id: "infographics.edit", privilge: "infographics.edit" },
            { id: "infographics.publish", privilge: "infographics.publish" },
          ],
        },
      ],
    },
    {
      id: "Abonnes",
      privilge: "subscribers.view",
      children: [
        { id: "subscribers.view", privilge: "subscribers.view" },
        { id: "subscribers.create", privilge: "subscribers.create" },
        { id: "subscribers.edit", privilge: "subscribers.edit" },
        { id: "subscribers.delete", privilge: "subscribers.delete" },
        { id: "subscribers.reset", privilge: "subscribers.reset" },
      ],
    },
    {
      id: "Tags",
      privilge: "tags.manage",
      children: [
        { id: "tags.view", privilge: "tags.view" },
        { id: "tags.create", privilge: "tags.create" },
        { id: "tags.edit", privilge: "tags.edit" },
        { id: "tags.delete", privilge: "tags.delete" },
      ],
    },
    {
      id: "Dossiers",
      privilge: "dossiers.manage",
      children: [
        { id: "dossiers.view", privilge: "dossiers.view" },
        { id: "dossiers.create", privilge: "dossiers.create" },
        { id: "dossiers.edit", privilge: "dossiers.edit" },
        { id: "dossiers.publish", privilge: "dossiers.publish" },
      ],
    },
    {
      id: "Bannieres",
      privilge: "banners.view",
      children: [
        { id: "banners.view", privilge: "banners.view" },
        { id: "banners.create", privilge: "banners.create" },
        { id: "banners.edit", privilge: "banners.edit" },
        { id: "banners.publish", privilge: "banners.publish" },
      ],
    },
    {
      id: "Utilisateurs",
      privilge: "users.manage",
      children: [
        { id: "users.view", privilge: "users.view" },
        { id: "users.create", privilge: "users.create" },
        { id: "users.edit", privilge: "users.edit" },
        { id: "users.delete", privilge: "users.delete" },
        { id: "users.block", privilge: "users.block" },
        { id: "users.reset", privilge: "users.reset" },
        { id: "users.assign_roles", privilge: "users.assign_roles" },
      ],
    },
    {
      id: "Categories",
      privilge: "categories.manage",
      children: [
        { id: "categories.view", privilge: "categories.view" },
        { id: "categories.create", privilge: "categories.create" },
        { id: "categories.edit", privilge: "categories.edit" },
        { id: "categories.activate", privilge: "categories.activate" },
        { id: "subcategories.view", privilge: "subcategories.view" },
        { id: "subcategories.create", privilge: "subcategories.create" },
        { id: "subcategories.edit", privilge: "subcategories.edit" },
        { id: "subcategories.activate", privilge: "subcategories.activate" },
        //{ id: "categories.default", privilge: "categories.default" },
      ],
    },
    {
      id: "Roles",
      privilge: "roles.view",
      children: [
        { id: "roles.view", privilge: "roles.view" },
        { id: "roles.create", privilge: "roles.create" },
        { id: "roles.edit", privilge: "roles.edit" },
        { id: "roles.delete", privilge: "roles.delete" },
      ],
    },
    {
      id: "Logs",
      privilge: "logs.articles.view",
      children: [
        { id: "logs.articles", privilge: "logs.articles.view" },
        { id: "logs.users", privilge: "logs.users.view" },
        { id: "logs.dossier", privilge: "logs.dossier.view" },
        { id: "logs.roles", privilge: "logs.roles.view" },
        { id: "logs.login_erreurs", privilge: "logs.login_erreurs.view" },
        { id: "logs.front", privilge: "logs.front.view" },
        { id: "logs.categories", privilge: "logs.categories.view" },
        { id: "logs.tags", privilge: "logs.tags.view" },
        { id: "logs.images", privilge: "logs.images.view" },
        { id: "logs.blocage", privilge: "logs.blocage.view" },
        { id: "logs.urgence", privilge: "logs.urgence.view" },
        { id: "logs.video", privilge: "logs.video.view" },
        { id: "logs.gallery", privilge: "logs.gallery.view" },
        { id: "logs.gallery_articles", privilge: "logs.gallery_articles.view" },
        { id: "logs.cahiers", privilge: "logs.cahiers.view" },
        { id: "logs.session", privilge: "logs.session.view" },
        { id: "logs.banner", privilge: "logs.banner.view" },
        { id: "logs.infographies", privilge: "logs.infographies.view" },
        { id: "logs.abonne", privilge: "logs.abonne.view" },
      ],
    },
  ];

  const filterMenuItems = (items) => {
    return items
      .map((item) => {
        // Special case for Acceuil - always include the main item
        if (item.id === "Acceuil") {
          // But filter its children based on privileges (these will be used to control UI elements)
          if (item.children) {
            item.children = item.children.filter((child) =>
              user.privileges.includes(child.privilge)
            );
          }
          // Always return Acceuil, even with empty children
          return { ...item };
        }

        // Regular processing for other menu items
        const hasPrivilge = item.privilge
          ? user.privileges.includes(item.privilge)
          : false;

        if (item.children) {
          item.children = filterMenuItems(item.children);
        }

        const hasChildren = item.children && item.children.length > 0;

        // For media: no privilge on parent, include if at least one child remains
        if (item.id === "Media") {
          return hasChildren ? { ...item } : null;
        }

        if (item.privilge) {
          // Parent requires a privilege — only show if user has it
          return hasPrivilge ? { ...item } : null;
        } else {
          // Parent doesn't require a privilege — only show if it has children
          return hasChildren ? { ...item } : null;
        }
      })
      .filter(Boolean);
  };

  return filterMenuItems(allMenuItems);
};

export const getAllConfigurations = async () => {
  const confs = await prisma.aps2024_configuration.findMany({
    orderBy: {
      is_active: "desc",
    },
  });

  return confs;
};

export const changeStateConfiguration = async (userData, logData) => {
  const { confId, actionBy } = userData;

  // Check if the configuration to change state exists in the database
  const existingConf = await prisma.aps2024_configuration.findUnique({
    where: { id_conf: confId },
  });

  // If the configuration doesn't exist, throw an error
  if (!existingConf) {
    logger.error({
      ...logData,
      action: "activation/desactivation",
      message: `Une tentative de modification de l'état d'une configuration inexistante.
      Informations de débogage :
      ID du configuration demandé : ${confId}`,
    });
    throw new ErrorHandler(400, "Dossier inexistante");
  }

  const updateData = existingConf.is_publish
    ? { desactivated_date: new Date(), desactivated_by: actionBy }
    : { activated_date: new Date(), activated_by: actionBy };

  // Update the state of the dossier in the database
  await prisma.aps2024_configuration.update({
    where: {
      id_conf: confId,
    },
    data: {
      is_active: !existingConf.is_active,
      ...updateData,
    },
  });

  // Return the name and new state of the dossier
  return { name: existingConf.name, is_active: existingConf.is_active };
};

export const getAllForbidenWords = async () => {
  const words = await prisma.aps2024_forbiddenword.findMany({
    orderBy: {
      id: "desc",
    },
  });

  return words;
};

export const createForbiddenWords = async (data) => {
  const { words, created_by } = data;
  // Normalize words to array
  const wordsArray = Array.isArray(words) ? words : [words];

  // Remove duplicates and convert to lowercase for consistency
  const uniqueWords = [
    ...new Set(wordsArray.map((word) => word.toLowerCase().trim())),
  ];

  // Check for existing words
  const existingWords = await prisma.aps2024_forbiddenword.findMany({
    where: {
      word: {
        in: uniqueWords,
      },
    },
    select: {
      word: true,
    },
  });

  const existingWordSet = new Set(existingWords.map((w) => w.word));
  const newWords = uniqueWords.filter((word) => !existingWordSet.has(word));

  if (newWords.length === 0) {
    throw new Error("All words already exist in forbidden words list");
  }

  // Prepare data for batch insert
  const wordsData = newWords.map((word) => ({
    word,
    created_by,
    created_date: new Date(),
  }));

  // Create multiple words
  await prisma.aps2024_forbiddenword.createMany({
    data: wordsData,
    skipDuplicates: true,
  });

  await forbiddenWordsService.loadForbiddenWords();
};

export const deleteForbiddenWords = async ({ ids }) => {
  // Normalize ids to array
  const idsArray = Array.isArray(ids) ? ids : [ids];

  // Check which IDs exist
  const existingRecords = await prisma.aps2024_forbiddenword.findMany({
    where: {
      id: {
        in: idsArray,
      },
    },
    select: {
      id: true,
      word: true,
    },
  });

  if (existingRecords.length === 0) {
    throw new ErrorHandler(
      404,
      "No forbidden words found with the provided IDs"
    );
  }

  const existingIds = existingRecords.map((record) => record.id);
  const nonExistingIds = idsArray.filter((id) => !existingIds.includes(id));

  // Throw error if any IDs don't exist
  if (nonExistingIds.length > 0) {
    throw new ErrorHandler(
      404,
      `Forbidden words not found with IDs: ${nonExistingIds.join(", ")}`
    );
  }

  // Delete the records
  await prisma.aps2024_forbiddenword.deleteMany({
    where: {
      id: {
        in: existingIds,
      },
    },
  });

  await forbiddenWordsService.loadForbiddenWords();
};
