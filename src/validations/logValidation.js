import Joi from "joi";

export const sessionSchema = Joi.object({
  date: Joi.date().iso().required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const clearSessionSchema = Joi.object({
  sessionId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const logsSchema = Joi.object({
  filename: Joi.string().required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const frontlogSchema = Joi.object({
  level: Joi.string().max(10).required(),
  folder: Joi.string().max(20).required(),
  action: Joi.string().max(20).allow(""),
  message: Joi.string().required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
