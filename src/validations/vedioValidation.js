import Joi from "joi";
const customUrlValidator = (value, helpers) => {
  try {
    new URL(value);
    return value;
  } catch (error) {
    return helpers.error("string.uri");
  }
};

export const videoSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  lien_video: Joi.string().custom(customUrlValidator),
  is_main: Joi.boolean(),
  position: Joi.number()
    .integer()
    .strict()
    .min(1)
    .max(4)
    .when("is_main", { is: true, then: Joi.forbidden() }), // Forbids position if is_main is true
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const getVideoschema = Joi.object({
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

export const videoIdSchema = Joi.object({
  videoId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const updateVideoSchema = Joi.object({
  videoId: Joi.number().integer().required().strict().disallow(0),
  name: Joi.string(),
  description: Joi.string(),
  lien_video: Joi.string().custom(customUrlValidator),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const searchVideoSchema = Joi.object({
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

export const getVideoPubishedSchema = Joi.object({
  videoId: Joi.number().integer().required().strict().disallow(0),
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

export const searchVideoPubishedSchema = Joi.object({
  videoId: Joi.number().integer().required().strict().disallow(0),
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

export const pinVideoSchema = Joi.object({
  videoId: Joi.number().integer().required().strict().disallow(0),
  is_pinned: Joi.boolean().required(),
  position: Joi.number().integer().strict().required().min(1).max(4),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
