import Joi from "joi";

export const gallerySchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  images: Joi.array().items(Joi.number().integer().strict()),
  type: Joi.bool().required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const getGallerysSchema = Joi.object({
  pageSize: Joi.number().integer().required().strict(),
  page: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const galleryIdSchema = Joi.object({
  galleryId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const galleryIdDeleteSchema = Joi.object({
  galleryId: Joi.number().integer().required().strict(),
  isConfirmed: Joi.bool().required(),
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

export const updateGallerySchema = Joi.object({
  galleryId: Joi.number().integer().required().strict(),
  name: Joi.string(),
  description: Joi.string(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
