import bcrypt from "bcryptjs";
import prisma from "../configs/database.js";
import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { generateOTP, sendOTPByEmail } from "../helpers/authHelper.js";
import { deniedLogger } from "../utils/logger.js";
import { blockMessage } from "../utils/blockMessage.js";

// Function to authenticate user login
export const login = async (userData, logdata) => {
  const { username, password } = userData;

  // find a unique user (by username)
  const user = await prisma.aps2024_users.findUnique({
    where: {
      username: username,
    },
    include: {
      aps2024_sessions: {
        where: {
          is_active: true,
          login_date: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Search only on the last day
          },
        },
      },
    },
  });

  // Handle error case when user is not found
  if (!user) {
    deniedLogger.error({
      ...logdata,
      username: username,
      message: `Une tentative de connexion avec un nom d'utilisateur inconnu a échoué.
       Informations de débogage :
       Nom d'utilisateur demandé : ${username}
`,
    });
    throw new ErrorHandler(401, "Username ou password incorrect.");
  }

  // Handle error case when user is desactivated

  if (user.state === 0) {
    deniedLogger.error({
      ...logdata,
      username: username,
      message: `Une tentative de connexion a échoué en utilisant un compte désactivé.
      Informations de débogage :
      Nom d'utilisateur demandé : ${username}`,
    });
    throw new ErrorHandler(401, "Username ou password incorrect.");
  }

  // Handle error case when account is blocked due to too many login attempts

  if (user.state === 2) {
    deniedLogger.error({
      ...logdata,
      username: username,
      message: `Une tentative de connexion a échoué en utilisant un compte bloqué.
      Informations de débogage :
      Nom d'utilisateur demandé : ${username}`,
    });
    throw new ErrorHandler(403, blockMessage[user.block_code].message);
  }

  // Handle error case when user has exceeded maximum login attempts
  if (user.login_attempts >= 3 && user.aps2024_sessions.length === 0) {
    // block user
    await prisma.aps2024_users.update({
      where: { id_user: user.id_user },
      data: {
        state: 2,
        block_code: 210,
        blocked_date: new Date(),
      },
    });
    deniedLogger.error({
      ...logdata,
      username: username,
      message: `Le compte de cet utilisateur est bloqué après 3 tentatives de connexion échoués.
      Informations de débogage :
      Nom d'utilisateur demandé : ${username}`,
    });
    throw new ErrorHandler(
      403,
      "Votre compte est bloqué, vous avez dépassé 3 tentatives."
    );
  }

  // Check if the password is correct
  const isCorrectPassword = await bcrypt.compare(password, user.password);

  if (!isCorrectPassword) {
    // if the password is incorrect  Increment login attempts counter
    await prisma.aps2024_users.update({
      where: { id_user: user.id_user },
      data: {
        login_attempts: user.login_attempts + 1,
      },
    });
    deniedLogger.error({
      ...logdata,
      username: username,
      message: `Une tentative de connexion avec un mot de passe incorrect a échoué.
      Informations de débogage :
      Nom d'utilisateur demandé : ${username}`,
    });
    throw new ErrorHandler(403, "Username ou password incorrect.");
  }

  // Check if user has an active session in database
  const existingSession = await prisma.aps2024_sessions.findFirst({
    where: {
      id_user: user.id_user,
      is_active: true,
      login_date: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Search only on the last day
      },
    },
  });

  if (existingSession) {
    // If user has an active session, prompt to close it
    const idSession = Number(existingSession.id_session);
    return {
      hasSession: true,
      data: { userId: user.id_user, sessionId: idSession, email: user.email },
    };
  }

  // if user doesn't have an active session
  // Generate OTP and send it to the user's email
  const { otpKey, otpExpirationTime } = generateOTP();

  await prisma.aps2024_users.update({
    where: { id_user: user.id_user },
    data: {
      otpkey: otpKey,
      otpTime: otpExpirationTime,
      login_attempts: 0,
    },
  });

  await sendOTPByEmail(user.email, otpKey);

  return {
    hasSession: false,
    data: { userId: user.id_user, email: user.email },
  };
};

// Verify OTP  provided by the user during login.
export const verifyOTP = async (userData, logdata) => {
  const { userId, otpKey, ip } = userData;

  // Find the user with the provided user ID and matching OTP key
  const user = await prisma.aps2024_users.findUnique({
    where: { id_user: userId },
    select: {
      id_user: true,
      first_name: true,
      last_name: true,
      username: true,
      otpkey: true,
      otpTime: true,
    },
  });
  if (!user) {
    deniedLogger.error({
      ...logdata,
      message: `Une tentative de connexion à (2FA) avec une userId incorrecte a échoué.
      Informations de débogage : 
      ID utilisateur demandé : ${userId}`,
    });
    throw new ErrorHandler(401, "Utilisateur n'exist pas");
  }

  if (otpKey !== user.otpkey) {
    // Clear OTP key and expiration time if the otpkey expired
    await prisma.aps2024_users.update({
      where: { id_user: userId },
      data: {
        otpkey: null,
        otpTime: null,
      },
    });
    deniedLogger.error({
      ...logdata,
      username: user.username,
      message: `Une tentative de connexion à (2FA) avec une clé OTP incorrecte a échoué.
      Informations de débogage : 
      Nom d'utilisateur demandé : ${user.username}`,
    });
    throw new ErrorHandler(401, "Le code OTP saisi incorrect.");
  }

  // Check if OTP has expired
  const currentDateTime = new Date();
  if (currentDateTime > user.otpTime) {
    // Clear OTP key and expiration time if the otpkey expired
    await prisma.aps2024_users.update({
      where: { id_user: userId },
      data: {
        otpkey: null,
        otpTime: null,
      },
    });

    deniedLogger.error({
      ...logdata,
      username: user.username,
      message: `Une tentative de connexion à l'authentification à deux facteurs (2FA) dans la section tableau de bord du site Web avec une clé OTP expirée a échoué.
      Informations de débogage :
      Nom d'utilisateur demandé : ${user.username}`,
    });
    throw new ErrorHandler(401, "OTP est expiré.");
  }

  // Clear OTP key and expiration time after successful verification
  await prisma.aps2024_users.update({
    where: { id_user: userId },
    data: {
      lastvisit_date: new Date(),
      otpkey: null,
      otpTime: null,
    },
  });

  // Create a new session for the user
  const newSession = await prisma.aps2024_sessions.create({
    data: {
      id_user: userId,
      adresse_ip: ip,
      is_active: true,
    },
  });

  const idSession = Number(newSession.id_session);

  return {
    sessionId: idSession,
    username: user.username,
    data: {
      userId: user.id_user,
      username: user.username,
      userFirstName: user.first_name,
      userLastName: user.last_name,
    },
  };
};

export const resendOtpKey = async (userData, logdata) => {
  const { userId } = userData;

  // find a unique user (by username) and his state is not desactivated
  const existingUser = await prisma.aps2024_users.findUnique({
    where: {
      id_user: userId,
      state: 1,
    },
  });

  if (!existingUser) {
    deniedLogger.error({
      ...logdata,
      message: `Une tentative de renvoi de la clé OTP à l'adresse e-mail de l'utilisateur pour (2FA) a échoué.
      Informations de débogage :
      Id utilisateur demandé : ${userId}`,
    });
    throw new ErrorHandler(401, "Aucun utilisateur trouvé");
  }

  // Generate OTP and send it to the user's email
  const { otpKey, otpExpirationTime } = generateOTP();

  const user = await prisma.aps2024_users.update({
    where: { id_user: userId },
    data: {
      otpkey: otpKey,
      otpTime: otpExpirationTime,
      login_attempts: 0,
    },
  });

  await sendOTPByEmail(user.email, otpKey);

  return {
    hasSession: false,
    username: user.username,
    data: { userId: userId, email: user.email },
  };
};

// Close the current session and send OTP  to the user's email for re-verification.
export const closeSessionAndSendOtpKey = async (userData, logdata) => {
  const { sessionId, userId, password, username } = userData;

  const user = await prisma.aps2024_users.findUnique({
    where: {
      id_user: userId,
    },
    select: {
      password: true,
      state: true,
      username: true,
      email: true,
    },
  });

  // Handle error case when user is not found
  if (!user) {
    deniedLogger.error({
      ...logdata,
      username: username,
      message: `Une tentative de fermer une session avec un id d'utilisateur inconnu a échoué.
       Informations de débogage :
       ID d'utilisateur demandé : ${userId}`,
    });
    throw new ErrorHandler(401, "Username ou password incorrect.");
  }

  if (user.state !== 1) {
    deniedLogger.error({
      ...logdata,
      message: `Une tentative de fermer une session avec un utilisateur inactif a échoué.
      Informations de débogage :
      Id utilisateur demandé : ${userId}`,
    });
    throw new ErrorHandler(401, "Compte utilisateur inactif ou bloqué");
  }

  if (user.username !== username) {
    deniedLogger.error({
      ...logdata,
      message: `Une tentative de fermer une session avec un nom d'utilisateur incorrect.
      Informations de débogage :
      Id utilisateur demandé : ${userId}`,
    });
    throw new ErrorHandler(401, "Username ou password incorrect.");
  }

  // Check if the password is correct
  const isCorrectPassword = await bcrypt.compare(password, user.password);

  if (!isCorrectPassword) {
    deniedLogger.error({
      ...logdata,
      username: user.username,
      message: `Une tentative de connexion avec un mot de passe incorrect a échoué.
        Informations de débogage :
        Nom d'utilisateur demandé : ${user.username}`,
    });
    throw new ErrorHandler(401, "Username ou password incorrect.");
  }

  // Find the session by session ID
  const existingSession = await prisma.aps2024_sessions.findUnique({
    where: {
      id_session: sessionId,
      is_active: true,
      id_user: userId,
    },
  });

  if (!existingSession) {
    deniedLogger.error({
      ...logdata,
      message: `Une tentative de fermer une session active et d'envoyer clé OTP a echoué.
      Informations de débogage :
      Id utilisateur demandé : ${userId}
      Id session demandé: ${sessionId}`,
    });
    throw new ErrorHandler(404, "Aucune session trouvé.");
  }

  // Close the current session

  await prisma.aps2024_sessions.update({
    where: {
      id_session: sessionId,
    },
    data: {
      is_active: false,
      logout_date: new Date(),
    },
  });

  // Generate OTP and send it to the user's email
  const { otpKey, otpExpirationTime } = generateOTP();

  await prisma.aps2024_users.update({
    where: { id_user: userId },
    data: {
      otpkey: otpKey,
      otpTime: otpExpirationTime,
      login_attempts: 0,
    },
  });

  await sendOTPByEmail(user.email, otpKey);

  return {
    hasSession: false,
    username: user.username,
    data: { userId: userId, email: user.email },
  };
};

// Log out the user by closing the current session.
export const logout = async (sessionId, logdata) => {
  const existingSession = await prisma.aps2024_sessions.findUnique({
    where: {
      id_session: sessionId,
    },
  });

  if (!existingSession) {
    deniedLogger.error({
      ...logdata,
      message: `Une tentative de déconnexion a echoué. Session non trouvée.
      Informations de débogage :
      Id session : ${sessionId}`,
    });
    throw new ErrorHandler(
      401,
      "Votre session a expiré. veuillez vous reconnecter pour continuer.",
      null,
      true
    );
  }

  // Close the current session
  await prisma.aps2024_sessions.update({
    where: { id_session: sessionId },
    data: { is_active: false, logout_date: new Date() },
  });
};

// Log out the user by closing the current session.
export const logoutOtherUser = async (userData) => {
  const { userId } = userData;

  // Find the session by session ID
  const existingSession = await prisma.aps2024_sessions.findFirst({
    where: {
      id_user: userId,
      is_active: true,
      login_date: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Search only on the last day
      },
    },
  });

  if (existingSession) {
    // Close the current session
    await prisma.aps2024_sessions.update({
      where: {
        id_session: existingSession.id_session,
      },
      data: {
        is_active: false,
        logout_date: new Date(),
      },
    });
  }
};
