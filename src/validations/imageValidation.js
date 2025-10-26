import Joi from "joi";

export const imageSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  credit: Joi.string(),
  type: Joi.bool().required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const updateImageSchema = Joi.object({
  imageId: Joi.number().integer().required().strict(),
  name: Joi.string(),
  description: Joi.string(),
  credit: Joi.string(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const getImagesSchema = Joi.object({
  pageSize: Joi.number().integer().required().strict(),
  page: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const imageIdSchema = Joi.object({
  imageId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const searchSchema = Joi.object({
  searchText: Joi.string().allow("").required(),
  pageSize: Joi.number().integer().required().strict().positive(),
  page: Joi.number().integer().required().strict().positive(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const imageIndexSchema = Joi.object({
  imageId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const imageRemoveIndexSchema = Joi.object({
  imageId: Joi.number().integer().required().strict(),
  indexId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
