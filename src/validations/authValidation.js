import Joi from "joi";

// Define schema for signIn
export const signInSchema = Joi.object({
  username: Joi.string().max(30).required(),
  password: Joi.string().max(16).required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const verifyOTPSchema = Joi.object({
  userId: Joi.number().integer().required().strict(),
  otpKey: Joi.number().integer(6).required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const closeSessionSchema = Joi.object({
  sessionId: Joi.number().integer().required().strict(),
  userId: Joi.number().integer().required().strict(),
  username: Joi.string().max(30).required(),
  password: Joi.string().max(20).required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const sendOtpSchema = Joi.object({
  userId: Joi.number().integer().required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
