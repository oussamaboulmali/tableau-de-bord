import Joi from "joi";
export const roleSchema = Joi.object({
  name: Joi.string().max(30).required(),
  description: Joi.string().allow(""),
  privileges: Joi.array()
    .items(Joi.number().integer().strict())
    .min(1)
    .required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const roleIdSchema = Joi.object({
  roleId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const roleUpdateSchema = Joi.object({
  roleId: Joi.number().integer().required().strict(),
  name: Joi.string().max(30),
  description: Joi.string(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const rolePrivilagesSchema = Joi.object({
  roleId: Joi.number().integer().required().strict(),
  privileges: Joi.array()
    .items(Joi.number().integer().strict())
    .min(1)
    .required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const roleUsersSchema = Joi.object({
  roleId: Joi.number().integer().required().strict(),
  users: Joi.array().items(Joi.number().integer().strict()).min(1).required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const rolePrivilageRemoveSchema = Joi.object({
  roleId: Joi.number().integer().required().strict(),
  privilegeId: Joi.number().integer().strict().required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const roleUserRemoveSchema = Joi.object({
  roleId: Joi.number().integer().required().strict(),
  userId: Joi.number().integer().strict().required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
