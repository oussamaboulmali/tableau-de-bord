import Joi from "joi";

export const userIdSchema = Joi.object({
  userId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const confIdSchema = Joi.object({
  confId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const getUserSchema = Joi.object({
  state: Joi.number().integer().strict().valid(0, 1, 2),
});

export const userSchema = Joi.object({
  roles: Joi.array().items(Joi.number().integer().strict()).min(1).required(),
  first_name: Joi.string(),
  last_name: Joi.string(),
  username: Joi.string().max(30).required(),
  birth_day: Joi.date(),
  phone_number: Joi.string().max(10),
  post: Joi.string(),
  email: Joi.string()
    .email()
    .required()
    .regex(/@aps\.dz$/),
  password: Joi.string().min(8).max(16).required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const resetPasswordSchema = Joi.object({
  userId: Joi.number().integer().required().strict(),
  password: Joi.string().min(8).max(16).required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const updatePasswordSchema = Joi.object({
  userId: Joi.number().integer().required().strict(),
  oldPassword: Joi.string().min(8).max(16).required(),
  newPassword: Joi.string().min(8).max(16).required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const changeStateSchema = Joi.object({
  userId: Joi.number().integer().required().strict(),
  type: Joi.bool(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const blockSchema = Joi.object({
  userId: Joi.number().integer().required().strict(),
  blockCode: Joi.number().integer().required().strict().valid(210, 220),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const updateUserSchema = Joi.object({
  userId: Joi.number().integer().required().strict(),
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

export const updateloggedUserSchema = Joi.object({
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

export const userRolesSchema = Joi.object({
  userId: Joi.number().integer().required().strict(),
  roles: Joi.array().items(Joi.number().integer().strict()).min(1).required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const userRolesRemoveSchema = Joi.object({
  userId: Joi.number().integer().required().strict(),
  roleId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const createForbiddenWordsSchema = Joi.object({
  words: Joi.alternatives()
    .try(
      Joi.string().trim().min(1).required(),
      Joi.array().items(Joi.string().trim().min(1)).min(1).required()
    )
    .required(),
});

export const deleteForbiddenWordsSchema = Joi.object({
  ids: Joi.alternatives()
    .try(
      Joi.number().integer().positive().required(),
      Joi.array().items(Joi.number().integer().positive()).min(1).required()
    )
    .required(),
});
