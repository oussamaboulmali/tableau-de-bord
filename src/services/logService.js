import path from "path";
import prisma from "../configs/database.js";
import fs from "fs";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";

const LOG_PATH = process.env.LOG_PATH || "/var/log/website";

export const getAllSessionsLogs = async ({ date }, currentUser) => {
  const dateToget = new Date(date);
  // Set time to beginning of the day
  dateToget.setHours(0, 0, 0, 0);

  // Determine which users the current user can view based on their role
  let userWhereCondition = {};

  // Filter based on role permissions
  if (currentUser.activeRoles.includes("SuperUser")) {
    // SuperUser can see all users - no additional filtering
  } else if (currentUser.activeRoles.includes("Admin")) {
    // Admin can see all users - no additional filtering
  } else if (currentUser.activeRoles.includes("Superviseur")) {
    // Superviseur can see all users except Admin and SuperUser roles
    userWhereCondition.aps2024_user_role = {
      none: {
        aps2024_roles: {
          name: { in: ["Admin", "SuperUser"] },
        },
      },
    };
  } else if (currentUser.activeRoles.includes("Rédacteur en chef")) {
    // "Rédacteur en chef" can only see users with specific roles
    userWhereCondition.aps2024_user_role = {
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
    // Default case - only see their own sessions
    userWhereCondition.id_user = currentUser.id_user;
  }

  // Fetch sessions for today from the database with role-based filtering
  const sessions = await prisma.aps2024_sessions.findMany({
    where: {
      login_date: {
        gte: dateToget, // Greater than or equal to start of the day
        lt: new Date(dateToget.getTime() + 24 * 60 * 60 * 1000), // Less than end of the day
      },
      aps2024_users: userWhereCondition,
    },
    include: {
      aps2024_users: {
        select: {
          username: true,
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
      },
    },
    orderBy: {
      login_date: "desc",
    },
  });

  // Convert BigInt to regular number before sending response
  const sessionsFormatted = sessions.map((session) => {
    const { aps2024_users, ...rest } = session;
    return {
      ...rest,
      id_session: Number(session.id_session),
      username: aps2024_users.username,
      user_roles: aps2024_users.aps2024_user_role.map(
        (ur) => ur.aps2024_roles.name
      ),
    };
  });

  return sessionsFormatted;
};

export const getActiveSessionsLogs = async ({ date }, currentUser) => {
  const dateToget = new Date(date);
  // Set time to beginning of the day
  dateToget.setHours(0, 0, 0, 0);

  // Determine which users the current user can view based on their role
  let userWhereCondition = {};

  // Filter based on role permissions
  if (currentUser.activeRoles.includes("SuperUser")) {
    // SuperUser can see all users - no additional filtering
  } else if (currentUser.activeRoles.includes("Admin")) {
    // Admin can see all users - no additional filtering
  } else if (currentUser.activeRoles.includes("Superviseur")) {
    // Superviseur can see all users except Admin and SuperUser roles
    userWhereCondition.aps2024_user_role = {
      none: {
        aps2024_roles: {
          name: { in: ["Admin", "SuperUser"] },
        },
      },
    };
  } else if (currentUser.activeRoles.includes("Rédacteur en chef")) {
    // "Rédacteur en chef" can only see users with specific roles
    userWhereCondition.aps2024_user_role = {
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
    // Default case - only see their own sessions
    userWhereCondition.id_user = currentUser.id_user;
  }

  // Fetch active sessions for today from the database with role-based filtering
  const sessions = await prisma.aps2024_sessions.findMany({
    where: {
      login_date: {
        gte: dateToget, // Greater than or equal to start of the day
        lt: new Date(dateToget.getTime() + 24 * 60 * 60 * 1000), // Less than end of the day
      },
      is_active: true,
      aps2024_users: userWhereCondition,
    },
    include: {
      aps2024_users: {
        select: {
          username: true,
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
      },
    },
    orderBy: {
      login_date: "desc",
    },
  });

  // Convert BigInt to regular number before sending response
  const sessionsFormatted = sessions.map((session) => {
    const { aps2024_users, ...rest } = session;
    return {
      ...rest,
      id_session: Number(session.id_session),
      username: aps2024_users.username,
      user_roles: aps2024_users.aps2024_user_role.map(
        (ur) => ur.aps2024_roles.name
      ),
    };
  });

  return sessionsFormatted;
};

export const clearSession = async (data) => {
  const { sessionId } = data;

  // Find the session by session ID
  const existingSession = await prisma.aps2024_sessions.findUnique({
    where: {
      id_session: sessionId,
    },
  });

  if (!existingSession) {
    throw new ErrorHandler(401, "there is no session founded");
  }

  // Close the current session
  const session = await prisma.aps2024_sessions.update({
    where: {
      id_session: sessionId,
    },
    data: {
      is_active: false,
      logout_date: new Date(),
    },
    include: {
      aps2024_users: {
        select: {
          username: true,
        },
      },
    },
  });

  return session.aps2024_users.username;
};

const parseJsonLogs = (data) => {
  // Split the data by newline characters to get individual JSON strings
  const jsonStrings = data.split("\n");

  const nonEmptyJsonStrings = jsonStrings.filter((str) => str.trim() !== "");

  // Parse each JSON string and return as an array of objects
  const parsedLogs = nonEmptyJsonStrings.map((jsonString) => {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return null;
    }
  });

  // Filter out any null values resulting from failed parsing
  return parsedLogs.filter((log) => log !== null);
};

export const getOneLog = async ({ filename }) => {
  const logFilePath = path.join(LOG_PATH, "logs_info", filename);
  try {
    // Read the log file and send its contents as response
    const data = await fs.promises.readFile(logFilePath, "utf-8");
    const parsedLogs = parseJsonLogs(data);

    // Filter logs based on PROJECT_LANG environment variable
    const projectLang = process.env.PROJECT_LANG;

    if (projectLang) {
      // Filter logs where website field matches PROJECT_LANG
      const filteredLogs = parsedLogs.filter((log) => {
        return log && log.website === projectLang;
      });
      return filteredLogs;
    }

    // If PROJECT_LANG is not set, return all logs
    return parsedLogs;
  } catch (err) {
    throw new ErrorHandler(401, "Error reading logs directory: " + err.message);
  }
};

export const getLogsFileName = async (currentUser) => {
  const logsPath = path.join(
    process.env.LOG_PATH || "/var/log/website",
    "logs_info"
  );

  // Add this mapping of folder names to required privileges
  const folderPrivilegeMap = {
    articles: "logs.articles.view",
    utilisateurs: "logs.users.view",
    dossiers: "logs.dossier.view",
    rôles: "logs.roles.view",
    erreurs_connexion: "logs.login_erreurs.view",
    catégories: "logs.categories.view",
    blocage: "logs.blocage.view",
    urgence: "logs.urgence.view",
    videos: "logs.video.view",
    galeries: "logs.gallery.view",
    galerie_articles: "logs.gallery_articles.view",
    cahiers: "logs.cahiers.view",
    bannieres: "logs.banner.view",
    infographies: "logs.infographies.view",
    erreurs_saisie: "logs.front.view",
    tags: "logs.tags.view",
    images: "logs.images.view",
    abonne: "logs.abonne.view",
  };

  try {
    const entries = await fs.promises.readdir(logsPath, {
      withFileTypes: true,
    });

    const folders = entries.filter((entry) => entry.isDirectory());

    // Add this filter to check permissions
    const authorizedFolders = folders.filter((folder) => {
      const requiredPrivilege = folderPrivilegeMap[folder.name];
      return (
        requiredPrivilege && currentUser.privileges.includes(requiredPrivilege)
      );
    });

    // Change 'folders' to 'authorizedFolders' in the Promise.all
    const responseData = await Promise.all(
      authorizedFolders.map(async (folder) => {
        const folderName = folder.name;
        const folderPath = path.join(logsPath, folderName);
        const files = await fs.promises.readdir(folderPath);
        return {
          [folderName.replace(/_/g, " ")]: files,
        };
      })
    );

    const result = Object.assign({}, ...responseData);
    return result;
  } catch (err) {
    throw new ErrorHandler(401, "Error reading logs directory:" + err.message);
  }
};
