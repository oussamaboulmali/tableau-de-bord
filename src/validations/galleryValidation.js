import Joi from "joi";

export const gallerySchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  credit: Joi.string(),
  position: Joi.number().integer().strict().min(1).max(4),
  is_watermarked: Joi.bool().required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const getGalleryschema = Joi.object({
  pageSize: Joi.number().integer().required().strict(),
  page: Joi.number().integer().required().strict(),
  order: Joi.object()
    .pattern(
      Joi.string().valid(
        "created_date",
        "name",
        "created_by",
        "publish_date",
        "publish_by",
        "is_publish",
        "description"
      ),
      Joi.string().valid("asc", "desc")
    )
    .length(1),
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

export const updateGallerySchema = Joi.object({
  galleryId: Joi.number().integer().required().strict().disallow(0),
  name: Joi.string(),
  description: Joi.string(),
  credit: Joi.string(),
  is_watermarked: Joi.bool(),
  imagesId: Joi.array().items(Joi.number().integer().strict()).required(),
  featuredImage: Joi.string(),
  featuredImageId: Joi.number().integer().strict(),
})
  .or("featuredImage", "featuredImageId")
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const searchGallerySchema = Joi.object({
  searchText: Joi.string().allow("").required(),
  pageSize: Joi.number().integer().required().strict(),
  page: Joi.number().integer().required().strict(),
  order: Joi.object()
    .pattern(
      Joi.string().valid(
        "created_date",
        "name",
        "created_by",
        "publish_date",
        "publish_by",
        "is_publish",
        "description"
      ),
      Joi.string().valid("asc", "desc")
    )
    .length(1),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const getGalleryPubishedSchema = Joi.object({
  galleryId: Joi.number().integer().required().strict().disallow(0),
  pageSize: Joi.number().integer().required().strict(),
  page: Joi.number().integer().required().strict(),
  order: Joi.object()
    .pattern(
      Joi.string().valid(
        "created_date",
        "name",
        "created_by",
        "publish_date",
        "publish_by",
        "is_publish",
        "description"
      ),
      Joi.string().valid("asc", "desc")
    )
    .length(1),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const searchGalleryPubishedSchema = Joi.object({
  galleryId: Joi.number().integer().required().strict().disallow(0),
  searchText: Joi.string().allow("").required(),
  pageSize: Joi.number().integer().required().strict(),
  page: Joi.number().integer().required().strict(),
  order: Joi.object()
    .pattern(
      Joi.string().valid(
        "created_date",
        "name",
        "created_by",
        "publish_date",
        "publish_by",
        "is_publish",
        "description"
      ),
      Joi.string().valid("asc", "desc")
    )
    .length(1),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const pinGallerySchema = Joi.object({
  galleryId: Joi.number().integer().required().strict().disallow(0),
  is_pinned: Joi.boolean().required(),
  position: Joi.number().integer().strict().required().min(1).max(4),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
