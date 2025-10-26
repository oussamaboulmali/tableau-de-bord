import prisma from "../configs/database.js";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";
import {
  getHighestRoleLevel,
  roleHierarchy,
  canManageRole,
  getRoleLevel,
} from "../utils/rolesHierarchy.js";

const logger = infoLogger("rôles");

export const createRole = async (data, logData) => {
  const { createdBy, name, description, privileges } = data;
  const privilagesName = [];

  // Check if role name is already taken
  const existingRole = await prisma.aps2024_roles.findUnique({
    where: { name: name },
  });

  if (existingRole) {
    logger.error({
      ...logData,
      message: `Une tentative de créer un nouveau role avec un nom ${existingRole.name} déjà pris.
      Informations de débogage :
      Nom demandé : ${name}`,
    });
    throw new ErrorHandler(401, "role déjà pris");
  }

  for (const privilegeId of privileges) {
    const existingPrivilege = await prisma.aps2024_privileges.findUnique({
      where: {
        id_privileges: privilegeId,
      },
      select: {
        name: true,
      },
    });

    if (!existingPrivilege) {
      logger.error({
        ...logData,
        message: `Une tentative de création d'un role avec un privilège inexistant.
        Informations de débogage :
        ID privilège demandé : ${privilegeId}`,
      });
      throw new ErrorHandler(401, "Un des privilèges est introuvable.");
    }

    privilagesName.push(existingPrivilege.name);
  }

  // Fetch all existing roles and their privileges
  const existingRoles = await prisma.aps2024_roles.findMany({
    include: {
      aps2024_roles_privileges: {
        select: {
          id_privileges: true,
        },
      },
    },
  });

  // Check if any existing role has the same set of privileges
  for (const existingRole of existingRoles) {
    const existingPrivileges = existingRole.aps2024_roles_privileges
      .map((privilege) => privilege.id_privileges)
      .sort();
    const newPrivileges = privileges.sort();

    if (arraysAreEqual(existingPrivileges, newPrivileges)) {
      logger.error({
        ...logData,
        message: `Une tentative de création d'un role avec les mêmes privilèges qu'un autre role existant.
        Informations de débogage :
        Role existant : ${existingRole.name}`,
      });
      throw new ErrorHandler(
        401,
        `Un role nommé ${existingRole.name} possède déjà ces privilèges.`
      );
    }
  }

  const newRole = await prisma.aps2024_roles.create({
    data: {
      name,
      description,
      created_by: createdBy,
      aps2024_roles_privileges: {
        createMany: {
          data: privileges.map((privilegeId) => ({
            id_privileges: privilegeId,
          })),
        },
      },
    },
  });

  return { roleId: newRole.id_role, privilagesName: privilagesName };
};

export const getAllRoles = async (currentUser) => {
  const userLevel = getHighestRoleLevel(currentUser.activeRoles);
  const isAdmin =
    currentUser.activeRoles.includes("Admin") ||
    currentUser.activeRoles.includes("SuperUser");

  // decide which role names may be queried
  const visibleRoles = isAdmin
    ? Object.keys(roleHierarchy) // all roles
    : Object.keys(roleHierarchy).filter(
        (role) => getRoleLevel(role) < userLevel // strictly lower level
      );

  // Return only roles at the same level or below the user's highest role
  const roles = await prisma.aps2024_roles.findMany({
    where: {
      name: {
        in: visibleRoles,
      },
    },
    orderBy: {
      created_date: "desc",
    },
  });

  if (!roles) {
    throw new ErrorHandler(404, "No Role found");
  }

  return roles;
};

export const getAllPrivilages = async (userId) => {
  // Fetch all privileges associated with the user's roles
  const userPrivileges = await prisma.aps2024_roles_privileges.findMany({
    where: {
      aps2024_roles: {
        aps2024_user_role: {
          some: {
            id_user: userId,
          },
        },
      },
    },
    select: {
      aps2024_privileges: true,
    },
    orderBy: {
      id_privileges: "asc",
    },
    distinct: "id_privileges",
  });

  return userPrivileges.map((item) => item.aps2024_privileges);
};

export const getOtherPrivilages = async ({ roleId }) => {
  const existingRole = await prisma.aps2024_roles.findUnique({
    where: { id_role: roleId },
  });

  if (!existingRole) {
    throw new ErrorHandler(401, "No Role Founded ");
  }

  const otherPrivilages = await prisma.aps2024_privileges.findMany({
    where: {
      NOT: {
        aps2024_roles_privileges: {
          some: {
            id_role: roleId,
          },
        },
      },
    },
    orderBy: {
      id_privileges: "asc",
    },
  });

  return otherPrivilages;
};

export const getOneRole = async ({ roleId }) => {
  const role = await prisma.aps2024_roles.findUnique({
    where: { id_role: roleId },
    include: {
      aps2024_roles_privileges: {
        orderBy: {
          id_privileges: "asc",
        },
        include: {
          aps2024_privileges: true,
        },
      },
    },
  });

  if (!role) {
    throw new ErrorHandler(404, "No Role found");
  }

  const formattedRole = {
    id_role: role.id_role,
    name: role.name,
    privileges: role.aps2024_roles_privileges.map((rp) => ({
      id_privileges: rp.aps2024_privileges.id_privileges,
      name: rp.aps2024_privileges.name,
      description: rp.aps2024_privileges.description,
    })),
  };

  return formattedRole;
};

export const getUsersOfRole = async ({ roleId }) => {
  const existingRole = await prisma.aps2024_roles.findUnique({
    where: { id_role: roleId },
  });

  if (!existingRole) {
    throw new ErrorHandler(401, "No Role Founded ");
  }
  const roleWithUsers = await prisma.aps2024_user_role.findMany({
    where: { id_role: roleId },
    include: {
      aps2024_roles: {
        select: {
          name: true,
        },
      },
      aps2024_users: {
        select: {
          id_user: true,
          username: true,
          email: true,
          post: true,
        },
      },
    },
  });

  return roleWithUsers.map((data) => data.aps2024_users);
};

export const getUsersWithOtherRoles = async ({ roleId }) => {
  const existingRole = await prisma.aps2024_roles.findUnique({
    where: { id_role: roleId },
  });

  if (!existingRole) {
    throw new ErrorHandler(401, "No Role Founded ");
  }

  // find users who do not have a role equal to the provided roleId
  const usersWithOtherRoles = await prisma.aps2024_users.findMany({
    where: {
      NOT: {
        aps2024_user_role: {
          some: {
            id_role: roleId,
          },
        },
      },
      state: { not: 0 },
    },
    select: {
      id_user: true,
      username: true,
      email: true,
    },
  });

  return usersWithOtherRoles;
};

export const updateRole = async (data, logData, currentUser) => {
  const { modifiedBy, roleId, name, description } = data;

  const existingRole = await prisma.aps2024_roles.findUnique({
    where: { id_role: roleId },
  });

  if (!existingRole) {
    logger.error({
      ...logData,
      message: `Une tentative de modification d'un role inexistant.
      Informations de débogage :
      ID du role demandé : ${roleId}`,
    });
    throw new ErrorHandler(401, "Role inexistante");
  }

  // Check if user can manage this role
  if (!canManageRole(currentUser.activeRoles, existingRole.name)) {
    logger.error({
      ...logData,
      message: `Permission denied: Attempted to update a role (${existingRole.name}) with insufficient privileges`,
    });
    throw new ErrorHandler(
      403,
      "Vous n'avez pas l'autorisation pour modifier ce rôle"
    );
  }

  // Check if new role name is already taken by another role
  if (name && name !== existingRole.name) {
    const existingRoleWithName = await prisma.aps2024_roles.findFirst({
      where: {
        name: name,
        NOT: { id_role: roleId },
      },
    });

    if (existingRoleWithName) {
      logger.error({
        ...logData,
        message: `Une tentative de modification du role avec un nom ${name} déjà pris.
        Informations de débogage :
        Nom demandé : ${name}`,
      });
      throw new ErrorHandler(401, "Nom déjà pris.");
    }
  }

  const updatedRole = await prisma.aps2024_roles.update({
    where: { id_role: roleId },
    data: {
      name: name || existingRole.name,
      description: description || existingRole.description,
      modified_by: modifiedBy,
      modified_date: new Date(),
    },
  });

  return updatedRole.name;
};

export const deleteRole = async ({ roleId }, logData, currentUser) => {
  // Check if role name is already taken
  const existingRole = await prisma.aps2024_roles.findUnique({
    where: { id_role: roleId },
  });

  if (!existingRole) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'un role inexistant.
      Informations de débogage :
      ID du role demandé : ${roleId}`,
    });
    throw new ErrorHandler(401, "Role inexistant.");
  }

  // Check if user can manage this role
  if (!canManageRole(currentUser.activeRoles, existingRole.name)) {
    logger.error({
      ...logData,
      message: `Permission denied: Attempted to delete a role (${existingRole.name}) with insufficient privileges`,
    });
    throw new ErrorHandler(
      403,
      "Vous n'avez pas l'autorisation pour supprimer ce rôle"
    );
  }
  // Check if an existing User has this role
  const existingUserWithRole = await prisma.aps2024_user_role.findFirst({
    where: { id_role: roleId },
    include: {
      aps2024_users: {
        select: {
          username: true,
        },
      },
    },
  });

  if (existingUserWithRole) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'un role attribué à un utilisateur.
      Informations de débogage :
      Role demandé : ${existingRole.name}
      Utilisateur : ${existingUserWithRole.aps2024_users.username}`,
    });
    throw new ErrorHandler(
      401,
      "Vous ne pouvez pas supprimer ce role car il est attribué à un utilisateur."
    );
  }

  await prisma.aps2024_roles.delete({
    where: {
      id_role: roleId,
    },
  });

  return existingRole.name;
};

export const addPrivilageToRole = async (data, logData, currentUser) => {
  const { roleId, privileges } = data;

  const privilagesName = [];

  const existingRole = await prisma.aps2024_roles.findUnique({
    where: { id_role: roleId },
  });

  if (!existingRole) {
    logger.error({
      ...logData,
      message: `Une tentative d'ajout des privilèges à un role inexistant.
      Informations de débogage :
      ID du role demandé : ${roleId}`,
    });
    throw new ErrorHandler(401, "Role inexistant.");
  }

  // Check if user can manage this role
  if (!canManageRole(currentUser.activeRoles, existingRole.name)) {
    logger.error({
      ...logData,
      message: `Permission denied: Attempted to add privileges to a role (${existingRole.name}) with insufficient privileges`,
    });
    throw new ErrorHandler(
      403,
      "Vous n'avez pas l'autorisation pour modifier ce rôle"
    );
  }

  for (const privilegeId of privileges) {
    const existingPrivilege = await prisma.aps2024_privileges.findUnique({
      where: {
        id_privileges: privilegeId,
      },
      select: {
        name: true,
      },
    });

    if (!existingPrivilege) {
      logger.error({
        ...logData,
        message: `Une Tentative d'ajout d'un privilège inexistant à un role.
        Informations de débogage :
        ID du privilège demandé : ${privilegeId}`,
      });
      throw new ErrorHandler(401, "Un des privilèges n'a pas été trouvé.");
    }
    // Check if the role already has the privilege
    const existingRolePrivilege =
      await prisma.aps2024_roles_privileges.findFirst({
        where: {
          id_role: roleId,
          id_privileges: privilegeId,
        },
      });

    if (existingRolePrivilege) {
      logger.error({
        ...logData,
        message: `Une Tentative d'ajout à un role d'un privilège qu'il possède déjà.
        Informations de débogage :
        Privilège demandé : ${privilegeId}`,
      });
      throw new ErrorHandler(401, "Role possède déjà l'un des privilèges.");
    }

    privilagesName.push(existingPrivilege.name);
  }

  // If the role doesn't have the privilege, create the relationship
  // Create role-privilege relationships
  const rolePrivilegeData = privileges.map((privilegeId) => ({
    id_role: roleId,
    id_privileges: privilegeId,
  }));

  await prisma.aps2024_roles_privileges.createMany({
    data: rolePrivilegeData,
  });

  return { roleName: existingRole.name, privilagesName: privilagesName };
};

export const removePrivilageFromRole = async (data, logData, currentUser) => {
  const { roleId, privilegeId } = data;

  const existingRole = await prisma.aps2024_roles.findUnique({
    where: { id_role: roleId },
  });

  if (!existingRole) {
    logger.error({
      ...logData,
      message: `Une tentative de supprimer un privilège d'un role inexistant.
      Informations de débogage :
      ID du role demandé : ${roleId}`,
    });
    throw new ErrorHandler(401, "Role inexistant");
  }

  // Check if user can manage this role
  if (!canManageRole(currentUser.activeRoles, existingRole.name)) {
    logger.error({
      ...logData,
      message: `Permission denied: Attempted to remove privilege from a role (${existingRole.name}) with insufficient privileges`,
    });
    throw new ErrorHandler(
      403,
      "Vous n'avez pas l'autorisation pour modifier ce rôle"
    );
  }

  // Check if the role  has the privilege
  const existingRolePrivilege = await prisma.aps2024_roles_privileges.findFirst(
    {
      where: {
        id_role: roleId,
        id_privileges: privilegeId,
      },
      include: {
        aps2024_privileges: {
          select: {
            name: true,
          },
        },
      },
    }
  );

  if (!existingRolePrivilege) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression d'un privilège que le role ne possède pas.
      Informations de débogage :
      ID du privilège demandé : ${privilegeId}`,
    });
    throw new ErrorHandler(401, "Role ne possède pas ce privilège.");
  }

  const countRolePrivilages = await prisma.aps2024_roles_privileges.count({
    where: {
      id_role: roleId,
    },
  });

  if (countRolePrivilages === 1) {
    throw new ErrorHandler(
      401,
      "Vous ne pouvez pas supprimer le dernier privilège du role."
    );
  } else {
    await prisma.aps2024_roles_privileges.deleteMany({
      where: {
        id_role: roleId,
        id_privileges: privilegeId,
      },
    });
  }

  // If the relationship exists, delete it

  return {
    roleName: existingRole.name,
    privilagesName: existingRolePrivilege.aps2024_privileges.name,
  };
};

export const addUsersToRole = async (data, logData, currentUser) => {
  const { roleId, users, assignedBy } = data;
  const usersName = [];

  const existingRole = await prisma.aps2024_roles.findUnique({
    where: { id_role: roleId },
  });

  if (!existingRole) {
    logger.error({
      ...logData,
      message: `Une tentative d'ajout des utilsateurs à un role inexistant.
      Informations de débogage :
      ID du role demandé : ${roleId}`,
    });
    throw new ErrorHandler(401, "Role inexistant");
  }

  // Check if user can elevate others to this role
  if (!canManageRole(currentUser.activeRoles, existingRole.name)) {
    logger.error({
      ...logData,
      message: `Permission denied: Attempted to add users to a role (${existingRole.name}) with insufficient privileges`,
    });
    throw new ErrorHandler(
      403,
      "Vous n'avez pas l'autorisation pour assigner ce rôle"
    );
  }

  for (const userId of users) {
    const existingUser = await prisma.aps2024_users.findUnique({
      where: {
        id_user: userId,
      },
    });

    if (!existingUser) {
      logger.error({
        ...logData,
        message: `Une Tentative d'ajout d'un utilisateur inexistant à un role.
        Informations de débogage :
        ID du utilisateur demandé : ${userId}`,
      });
      throw new ErrorHandler(401, "Un des utilisateurs n'a pas été trouvé.");
    }

    const existingUserRole = await prisma.aps2024_user_role.findFirst({
      where: {
        id_user: userId,
        id_role: roleId,
      },
    });

    if (existingUserRole) {
      logger.error({
        ...logData,
        message: `Une tentative d'ajout d'un role à un utilisateur qui le possède déjà.
        Informations de débogage :
        ID de l'utilisateur demandé : ${userId}`,
      });
      throw new ErrorHandler(
        401,
        `L'utilisateur avec l'identifiant ${userId} possède déjà ce role.`
      );
    }

    usersName.push({
      userId,
      username: existingUser.username,
    });
  }

  // If the user doesn't have the role, create the relationship
  // Create user-role relationships
  const createdData = users.map((userId) => ({
    id_role: roleId,
    id_user: userId,
    assigned_by: assignedBy,
  }));

  await prisma.aps2024_user_role.createMany({
    data: createdData,
  });

  return {
    roleName: existingRole.name,
    usersName,
  };
};

export const removeUsersFromRole = async (data, logData, currentUser) => {
  const { roleId, userId } = data;

  const existingRole = await prisma.aps2024_roles.findUnique({
    where: { id_role: roleId },
  });

  if (!existingRole) {
    logger.error({
      ...logData,
      message: `Une tentative de supprimer un utilisateur d'un role inexistant.
      Informations de débogage :
      ID du role demandé : ${roleId}`,
    });
    throw new ErrorHandler(401, "Role inexistant.");
  }

  // Check if user can manage this role
  if (!canManageRole(currentUser.activeRoles, existingRole.name)) {
    logger.error({
      ...logData,
      message: `Permission denied: Attempted to remove a user from role (${existingRole.name}) with insufficient privileges`,
    });
    throw new ErrorHandler(
      403,
      "Vous n'avez pas l'autorisation pour gérer ce rôle"
    );
  }
  // Check if the user  has the role
  const existingRoleUser = await prisma.aps2024_user_role.findFirst({
    where: {
      id_role: roleId,
      id_user: userId,
    },
    include: {
      aps2024_users: {
        select: {
          username: true,
        },
      },
    },
  });

  if (!existingRoleUser) {
    logger.error({
      ...logData,
      message: `Une tentative de suppression du role d'un utilisateur qui ne le possède pas.
      Informations de débogage :
      ID de l'utilisateur demandé : ${userId}`,
    });
    throw new ErrorHandler(401, "L'utilisateur ne possède pas ce role.");
  }

  // If the relationship exists, delete it
  await prisma.aps2024_user_role.delete({
    where: {
      id_user_id_role: {
        id_user: userId,
        id_role: roleId,
      },
    },
  });

  return {
    roleName: existingRole.name,
    username: existingRoleUser.aps2024_users.username,
  };
};

// Function to check if two arrays are equal
function arraysAreEqual(array1, array2) {
  if (array1.length !== array2.length) {
    return false;
  }
  for (let i = 0; i < array1.length; i++) {
    if (array1[i] !== array2[i]) {
      return false;
    }
  }
  return true;
}
