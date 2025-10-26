import prisma from "../configs/database.js";
import { ErrorHandler } from "./errorMiddleware.js";

/**
 * Middleware function to authenticate user session and if he has an active session
 */
export const isAuthenticated = async (req, res, next) => {
  try {
    // Check if session exists
    const sessionId = req.session?.sessionId;

    // If no session found, throw unauthorized error
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        message:
          "Votre session a expiré. veuillez vous reconnecter pour continuer.",
        hasSession: false,
        logout: false,
      });
    }

    // Check if session is active in the database
    const existingSession = await prisma.aps2024_sessions.findUnique({
      where: {
        id_session: sessionId,
        is_active: true,
        aps2024_users: {
          state: 1,
        },
      },
    });

    // If session not found or inactive, throw unauthorized error
    if (!existingSession) {
      req.session.destroy((err) => {
        if (err) console.error("Session destruction error:", err);
      });

      return res.status(403).json({
        success: false,
        message:
          "Votre session a expiré, veuillez vous reconnecter pour continuer.",
        hasSession: false,
        logout: false,
      });
    }

    // Update session last activity timestamp
    // await prisma.aps2024_sessions.update({
    //   where: { id_session: sessionId },
    //   data: { logout_date: new Date() },
    // });

    // Load user permissions
    const permissionsLoaded = await _loadUserPermissions(req);

    if (!permissionsLoaded) {
      throw new ErrorHandler(
        500,
        "Erreur lors du chargement des permissions utilisateur",
        false
      );
    }
    // If authentication succeeds, move to the next middleware/controller
    next();
  } catch (error) {
    // If any error occurs, pass it to the error handler middleware
    return next(error);
  }
};

/**
 * Load user permissions from database and attach to request
 * Internal function used by isAuthenticated
 */
const _loadUserPermissions = async (req) => {
  const userId = req.session.userId;

  if (!userId) {
    return false;
  }

  try {
    // Check if privileges are already cached in session
    if (req.session.userPrivileges && req.session.userRoles) {
      req.user = {
        id_user: userId,
        activeRoles: req.session.userRoles,
        privileges: req.session.userPrivileges,
      };
      return true;
    }

    // If not cached, load from database
    const user = await prisma.aps2024_users.findUnique({
      where: {
        id_user: userId,
        state: 1, // Ensure user is active
      },
      select: {
        aps2024_user_role: {
          select: {
            isInterim: true,
            endDate: true,
            aps2024_roles: {
              select: {
                name: true,
                aps2024_roles_privileges: {
                  select: {
                    aps2024_privileges: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return false;
    }

    // Filter out expired interim roles
    const currentDate = new Date();
    const activeRoles = user.aps2024_user_role.filter(
      (userRole) =>
        !userRole.isInterim ||
        (userRole.endDate && userRole.endDate > currentDate)
    );

    // Extract privileges and roles
    const privileges = new Set();
    const roleNames = new Set();

    activeRoles.forEach((userRole) => {
      roleNames.add(userRole.aps2024_roles.name);
      userRole.aps2024_roles.aps2024_roles_privileges.forEach((rp) => {
        privileges.add(rp.aps2024_privileges.name);
      });
    });

    // Convert to arrays
    const privilegesArray = Array.from(privileges);
    const rolesArray = Array.from(roleNames);

    // Cache in session
    req.session.userPrivileges = privilegesArray;
    req.session.userRoles = rolesArray;
    req.session.permissionsLoadedAt = Date.now();

    // Attach to request object
    req.user = {
      id_user: userId,
      activeRoles: rolesArray,
      privileges: privilegesArray,
    };

    return true;
  } catch (error) {
    console.error("Error loading user privileges:", error);
    return false;
  }
};

/**
 * Permission-based authorization middleware
 * @param {string|string[]} requiredPrivileges - Permission(s) required to access the route
 */
export const hasPrivilege = (requiredPrivileges) => {
  return (req, res, next) => {
    // Check if user is loaded
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentification requise",
      });
    }

    const permissionsToCheck = Array.isArray(requiredPrivileges)
      ? requiredPrivileges
      : [requiredPrivileges];

    const hasAllPermissions = permissionsToCheck.every((privilege) =>
      req.user.privileges.includes(privilege)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        success: false,
        message:
          "Vous n'avez pas les permissions nécessaires pour effectuer cette action",
      });
    }

    next();
  };
};

/**
 * Role-based authorization middleware
 * @param {string|string[]} requiredRoles - Role(s) required to access the route
 */
export const hasRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentification requise",
      });
    }

    const rolesToCheck = Array.isArray(requiredRoles)
      ? requiredRoles
      : [requiredRoles];

    const hasAnyRole = rolesToCheck.some((role) =>
      req.user.activeRoles.includes(role)
    );

    if (!hasAnyRole) {
      return res.status(403).json({
        success: false,
        message:
          "Vous n'avez pas le rôle nécessaire pour effectuer cette action",
      });
    }

    next();
  };
};

/**
 * Log user activity
 * @param {string} action - The action performed
 * @param {string} entity - The entity acted upon
 * @param {number} entityId - The ID of the entity
 * @param {string} details - Additional details about the action
 */
const logActivity = async (
  req,
  action,
  entity,
  entityId = null,
  details = null
) => {
  try {
    if (!req.user) return;

    await prisma.log.create({
      data: {
        userId: req.user.id,
        action,
        entity,
        entityId,
        details,
        ipAddress: req.ip,
        logType: "user_action",
      },
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
};

async function setupRolesAndPermissions() {
  try {
    console.log("Starting roles and privileges setup...");

    // Create base privileges
    const privilegesData = [
      // Article privileges
      { name: "articles.create", description: "Create new articles" },
      { name: "articles.view", description: "View articles" },
      { name: "articles.edit", description: "Edit articles" },
      //{ name: "articles.delete", description: "Delete articles" },
      { name: "articles.trash", description: "Move articles to trash" },
      {
        name: "articles.publish",
        description: "Publish or unpublish articles",
      },
      {
        name: "articles.schedule",
        description: "Schedule article publication",
      },
      { name: "articles.pin", description: "Pin or unpin articles" },

      // Infographic privileges
      { name: "infographics.create", description: "Create new infographics" },
      { name: "infographics.view", description: "View infographics" },
      { name: "infographics.edit", description: "Edit infographics" },
      {
        name: "infographics.publish",
        description: "Publish or unpublish infographics",
      },
      // Cahier privileges
      { name: "cahiers.create", description: "Create new cahiers" },
      { name: "cahiers.view", description: "View cahiers" },
      { name: "cahiers.edit", description: "Edit cahiers" },
      {
        name: "cahiers.publish",
        description: "Publish or unpublish cahiers",
      },

      // Video privileges
      {
        name: "video.create",
        description: "Create new video content",
      },
      { name: "video.view", description: "View video content" },
      { name: "video.edit", description: "Edit video content" },
      {
        name: "video.publish",
        description: "Publish or unpublish video content",
      },
      {
        name: "video.pin",
        description: "Pin or unpin video content",
      },
      {
        name: "video.main",
        description: "Make video content main",
      },
      // Gallery photo privileges
      {
        name: "gallery.create",
        description: "Create new gallery content",
      },
      { name: "gallery.view", description: "View gallery content" },
      { name: "gallery.edit", description: "Edit gallery content" },
      {
        name: "gallery.publish",
        description: "Publish or unpublish gallery content",
      },
      {
        name: "gallery.pin",
        description: "Pin or unpin gallery content",
      },

      // Emergency band privileges
      { name: "emergency.create", description: "Create emergency bands" },
      { name: "emergency.view", description: "View emergency bands" },
      { name: "emergency.edit", description: "Edit emergency bands" },
      {
        name: "emergency.publish",
        description: "Publish or unpublish emergency bands",
      },

      // Tag privileges
      {
        name: "tags.manage",
        description: "Show tags Managing Page",
      },
      { name: "tags.create", description: "Create tags" },
      { name: "tags.view", description: "View tags" },
      { name: "tags.edit", description: "Edit tags" },
      { name: "tags.delete", description: "Delete tags" },

      // Dossier privileges
      {
        name: "dossiers.manage",
        description: "Show dossiers Managing Page",
      },
      { name: "dossiers.create", description: "Create dossiers" },
      { name: "dossiers.view", description: "View dossiers" },
      { name: "dossiers.edit", description: "Edit dossiers" },
      {
        name: "dossiers.publish",
        description: "Publish or unpublish dossiers",
      },
      {
        name: "dossiers.articles",
        description: "Add or remove articles to/from dossiers",
      },

      // Banner privileges
      { name: "banners.create", description: "Create banners" },
      { name: "banners.view", description: "View banners" },
      { name: "banners.edit", description: "Edit banners" },
      { name: "banners.publish", description: "Publish or unpublish banners" },

      // User privileges
      { name: "users.create", description: "Create users" },
      { name: "users.view", description: "View users" },
      { name: "users.edit", description: "Edit users" },
      { name: "users.edit.self", description: "Edit users self data" },
      { name: "users.activate", description: "Activate or desactivate users" },
      { name: "users.block", description: "Block or unblock users" },
      { name: "users.reset", description: "Reset users password" },
      { name: "users.manage", description: "Reset manage" },
      //{ name: "users.delete", description: "Delete users" },
      {
        name: "users.assign_roles",
        description: "Assign roles or remove to user",
      },

      // configurations privileges
      {
        name: "configurations.view",
        description: "View configuration",
      },

      {
        name: "configurations.activate",
        description: "Activate or desactivate one configuration",
      },

      // Subscriber privileges
      { name: "subscribers.create", description: "Create subscribers" },
      { name: "subscribers.view", description: "View subscribers" },
      { name: "subscribers.edit", description: "Edit subscribers" },
      { name: "subscribers.delete", description: "Delete subscribers" },
      {
        name: "subscribers.activate",
        description: "Activate or desactivate users",
      },
      { name: "subscribers.block", description: "Block or unblock users" },
      { name: "subscribers.reset", description: "Reset subscribers passowrd" },

      // Log privileges
      { name: "logs.articles.view", description: "View article logs" },
      { name: "logs.users.view", description: "View user logs" },
      { name: "logs.dossier.view", description: "View dossier logs" },
      { name: "logs.roles.view", description: "View roles logs" },
      {
        name: "logs.login_erreurs.view",
        description: "View user login error logs",
      },
      { name: "logs.front.view", description: "View input error logs" },
      { name: "logs.categories.view", description: "View categories logs" },
      { name: "logs.tags.view", description: "View tags logs" },
      { name: "logs.images.view", description: "View images logs" },
      { name: "logs.blocage.view", description: "View blocage logs" },
      { name: "logs.urgence.view", description: "View urgence logs" },
      { name: "logs.video.view", description: "View video logs" },
      { name: "logs.gallery.view", description: "View gallery logs" },
      {
        name: "logs.gallery_articles.view",
        description: "View gallery articles logs",
      },
      { name: "logs.cahiers.view", description: "View cahiers logs" },
      { name: "logs.session.view", description: "View session logs" },
      { name: "logs.banner.view", description: "View banners logs" },
      { name: "logs.infographies.view", description: "View infographies logs" },
      { name: "logs.abonne.view", description: "View abonne logs" },

      // Role privileges
      { name: "roles.create", description: "Create roles" },
      { name: "roles.view", description: "View roles" },
      { name: "roles.edit", description: "Edit roles" },
      { name: "roles.delete", description: "Delete roles" },
      {
        name: "roles.assign_users",
        description: "Assign or remove users to role",
      },
      {
        name: "roles.assign_privileges",
        description: "Assign or remove privileges to role",
      },

      // Privileges privileges
      { name: "privileges.create", description: "Create privileges" },
      { name: "privileges.view", description: "View privileges" },
      { name: "privileges.edit", description: "Edit privileges" },
      { name: "privileges.delete", description: "Delete privileges" },

      // Categories privileges
      {
        name: "categories.manage",
        description: "Show categories Managing Page",
      },
      { name: "categories.create", description: "Create categories" },
      { name: "categories.view", description: "View categories" },
      { name: "categories.edit", description: "Edit categories" },
      {
        name: "categories.activate",
        description: "Activate or desactivate categories",
      },
      {
        name: "categories.default",
        description: "View Set default categorie / subcategorie",
      },
      // subCategories privileges
      { name: "subcategories.create", description: "Create subcategories" },
      { name: "subcategories.view", description: "View subcategories" },
      { name: "subcategories.edit", description: "Edit subcategories" },
      {
        name: "subcategories.activate",
        description: "Activate or desactivate subcategories",
      },
    ];

    for (const privData of privilegesData) {
      await prisma.aps2024_privileges.upsert({
        update: { description: privData.description },
        create: privData,
        where: { name: privData.name },
      });
    }
    console.log(`Created ${privilegesData.length} privileges`);

    // Create roles
    const rolesData = [
      { name: "Rédacteur", description: "Basic content creator" },
      {
        name: "Chef de vacation",
        description: "Vacation chief with temporary publishing powers",
      },
      {
        name: "Rédacteur en chef",
        description: "Editor-in-chief with user management abilities",
      },
      { name: "Infographe", description: "Infographic creator" },
      { name: "Vidéaste", description: "Video content creator" },
      { name: "Photographe", description: "Gallery content creator" },
      {
        name: "Superviseur",
        description: "System supervisor with logs access",
      },
      {
        name: "Admin",
        description: "Administrator with full system access",
      },
      {
        name: "SuperUser",
        description: "Administrator with full system access",
      },
    ];

    for (const roleData of rolesData) {
      await prisma.aps2024_roles.upsert({
        where: { name: roleData.name },
        update: { description: roleData.description },
        create: { ...roleData, created_by: "oussama" },
      });
    }
    console.log(`Created ${rolesData.length} roles`);

    // Role-Permission Matrix
    const rolePermissionMatrix = {
      // Redacteur privileges
      Rédacteur: [
        "articles.create",
        "articles.view",
        "articles.edit",
        "articles.trash",
        "emergency.create",
        "emergency.view",
        "emergency.edit",
        "emergency.delete",
        "categories.view",
        "subcategories.view",
        "tags.view",
        "dossiers.view",
        "users.edit.self",
        "users.view",
        "video.create",
        "video.view",
        "video.edit",
        "users.edit.self",
        "users.view",
        "gallery.create",
        "gallery.view",
        "gallery.edit",
        "users.edit.self",
        "users.view",
      ],

      // Infographe privileges
      Infographe: [
        "infographics.create",
        "infographics.view",
        "infographics.edit",
        "cahiers.create",
        "cahiers.view",
        "cahiers.edit",
        "users.edit.self",
        "users.view",
      ],

      // Video author privileges
      Vidéaste: [
        "video.create",
        "video.view",
        "video.edit",
        "users.edit.self",
        "users.view",
      ],

      // Gallery photo author privileges
      Photographe: [
        "gallery.create",
        "gallery.view",
        "gallery.edit",
        "users.edit.self",
        "users.view",
      ],

      // Chef vacation privileges - includes Rédacteur, Infographe, Vidéaste + more
      "Chef de vacation": [
        "articles.create",
        "articles.view",
        "articles.edit",
        "articles.trash",
        "articles.publish",
        "articles.schedule",
        "articles.pin",
        "infographics.create",
        "infographics.view",
        "infographics.edit",
        "infographics.publish",
        "cahiers.create",
        "cahiers.view",
        "cahiers.edit",
        "cahiers.publish",
        "video.create",
        "video.view",
        "video.edit",
        "video.publish",
        "video.pin",
        "video.main",
        "gallery.create",
        "gallery.view",
        "gallery.edit",
        "gallery.publish",
        "gallery.pin",
        "emergency.create",
        "emergency.view",
        "emergency.edit",
        "emergency.delete",
        "tags.create",
        "tags.view",
        "tags.edit",
        "tags.delete",
        "dossiers.create",
        "dossiers.view",
        "dossiers.edit",
        "dossiers.publish",
        "dossiers.articles",
        "banners.create",
        "banners.view",
        "banners.edit",
        "banners.publish",
        "categories.view",
        "subcategories.view",
        "dossiers.manage",
        "tags.manage",
        "users.edit.self",
        "users.view",
      ],

      // Redacteur chef privileges - chef vacation + user management
      "Rédacteur en chef": [
        "articles.create",
        "articles.view",
        "articles.edit",
        "articles.trash",
        "articles.publish",
        "articles.schedule",
        "articles.pin",
        "categories.default",
        "infographics.create",
        "infographics.view",
        "infographics.edit",
        "infographics.publish",
        "cahiers.create",
        "cahiers.view",
        "cahiers.edit",
        "cahiers.publish",
        "video.create",
        "video.view",
        "video.edit",
        "video.publish",
        "video.pin",
        "video.main",
        "gallery.create",
        "gallery.view",
        "gallery.edit",
        "gallery.publish",
        "gallery.pin",
        "emergency.create",
        "emergency.view",
        "emergency.edit",
        "emergency.delete",
        "tags.create",
        "tags.view",
        "tags.edit",
        "tags.delete",
        "dossiers.create",
        "dossiers.view",
        "dossiers.edit",
        "dossiers.publish",
        "dossiers.articles",
        "banners.create",
        "banners.view",
        "banners.edit",
        "banners.publish",
        "users.create",
        "users.view",
        "users.edit",
        "users.assign_roles",
        "users.assign_interim",
        "logs.articles.view",
        "logs.users.view",
        "categories.default",
        "categories.view",
        "subcategories.view",
        "dossiers.manage",
        "tags.manage",
        "users.edit.self",
        "users.view",
        "users.manage",
      ],

      // Superviseur privileges
      Superviseur: [
        "users.create",
        "users.view",
        "users.edit",
        "users.activate",
        "users.block",
        "users.reset",
        "logs.articles.view",
        "logs.users.view",
        "logs.system.view",
        "users.edit.self",
        "users.view",
      ],

      // Admin privileges - all privileges
      Admin: privilegesData.map((p) => p.name),
      SuperUser: privilegesData.map((p) => p.name),
    };

    // Assign privileges to roles
    for (const [roleName, privileges] of Object.entries(rolePermissionMatrix)) {
      const role = await prisma.aps2024_roles.findUnique({
        where: { name: roleName },
      });

      if (!role) {
        console.error(`Role ${roleName} not found`);
        continue;
      }

      // Get all privilge records that match the names in the matrix
      const privilgeRecords = await prisma.aps2024_privileges.findMany({
        where: {
          name: {
            in: privileges,
          },
        },
      });

      // Create role-privilge relationships
      for (const privilge of privilgeRecords) {
        await prisma.aps2024_roles_privileges.upsert({
          where: {
            id_privileges_id_role: {
              id_role: role.id_role,
              id_privileges: privilge.id_privileges,
            },
          },
          update: {},
          create: {
            id_role: role.id_role,
            id_privileges: privilge.id_privileges,
          },
        });
      }

      console.log(
        `Assigned ${privilgeRecords.length} privileges to ${roleName}`
      );
    }

    // Create an Admin user if it doesn't exist
    // const adminUser = await prisma.user.upsert({
    //   where: { email: "Admin@newspress.com" },
    //   update: {},
    //   create: {
    //     email: "Admin@newspress.com",
    //     username: "Admin",
    //     password:
    //       "$2b$10$dJfFdaANtjkdeMne4zAYteuB0QHSCupbQMqJzU1vgBdNdmtTsJXsW", // hashed 'admin123'
    //     firstName: "Admin",
    //     lastName: "User",
    //     active: true,
    //   },
    // });

    // // Assign Admin role to Admin user
    // const adminRole = await prisma.role.findUnique({
    //   where: { name: "Admin" },
    // });

    // if (adminRole) {
    //   await prisma.userRole.upsert({
    //     where: {
    //       userId_roleId: {
    //         userId: adminUser.id,
    //         roleId: adminRole.id,
    //       },
    //     },
    //     update: {},
    //     create: {
    //       userId: adminUser.id,
    //       roleId: adminRole.id,
    //     },
    //   });
    //   console.log("Assigned Admin role to Admin user");
    // }

    console.log("Roles and privileges setup completed successfully");
  } catch (error) {
    console.error("Error setting up roles and privileges:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
// setupRolesAndPermissions()
//   .then(() => console.log("Setup complete"))
//   .catch((e) => console.error("Setup failed:", e));

export const validateClient = async (req, res, next) => {
  try {
    const validApiKey = process.env.API_KEY;
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
      throw new ErrorHandler(
        401,
        "Vous n'êtes pas autorisé à faire cela. missing key"
      );
    }

    if (apiKey !== validApiKey) {
      throw new ErrorHandler(
        401,
        "Vous n'êtes pas autorisé à faire cela. invalid key"
      );
    }
  } catch (error) {
    // If any error occurs, pass it to the error handler middleware
    return next(error);
  }
  // API key is valid
  next();
};
