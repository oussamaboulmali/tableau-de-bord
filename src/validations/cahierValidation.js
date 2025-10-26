import Joi from "joi";

export const cahierSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const cahierIdSchema = Joi.object({
  cahierId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const updateCahierSchema = Joi.object({
  cahierId: Joi.number().integer().required().strict(),
  name: Joi.string(),
  description: Joi.string(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const getCahierschema = Joi.object({
  pageSize: Joi.number().integer().required().strict(),
  page: Joi.number().integer().required().strict(),
  order: Joi.object()
    .pattern(
      Joi.string().valid("created_date", "name", "created_by"),
      Joi.string().valid("asc", "desc")
    )
    .length(1),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const searchCahierSchema = Joi.object({
  searchText: Joi.string().allow("").required(),
  pageSize: Joi.number().integer().required().strict(),
  page: Joi.number().integer().required().strict(),
  order: Joi.object()
    .pattern(
      Joi.string().valid("created_date", "name", "created_by"),
      Joi.string().valid("asc", "desc")
    )
    .length(1),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
