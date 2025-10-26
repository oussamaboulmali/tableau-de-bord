import Joi from "joi";

export const subscriberIdSchema = Joi.object({
  subscriberId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const subscriberSchema = Joi.object({
  first_name: Joi.string(),
  last_name: Joi.string(),
  username: Joi.string().max(30).required(),
  phone_number: Joi.string().max(10),
  post: Joi.string(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(16).required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const resetPasswordSchema = Joi.object({
  subscriberId: Joi.number().integer().required().strict(),
  password: Joi.string().min(8).max(16).required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const changeStateSchema = Joi.object({
  subscriberId: Joi.number().integer().required().strict(),
  type: Joi.bool(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const blockSchema = Joi.object({
  subscriberId: Joi.number().integer().required().strict(),
  blockCode: Joi.number().integer().required().strict().valid(210, 220),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const updateSubscriberSchema = Joi.object({
  subscriberId: Joi.number().integer().required().strict(),
  first_name: Joi.string(),
  last_name: Joi.string(),
  birth_day: Joi.date(),
  phone_number: Joi.string().max(10),
  post: Joi.string(),
  email: Joi.string()
    .max(30)
    .email()
    .regex(/@aps\.dz$/),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
