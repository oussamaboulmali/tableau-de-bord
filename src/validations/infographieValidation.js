import Joi from "joi";

export const infographieSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const getInfographieschema = Joi.object({
  pageSize: Joi.number().integer().required().strict(),
  page: Joi.number().integer().required().strict(),
  order: Joi.object()
    .pattern(
      Joi.string().valid(
        "created_date",
        "description",
        "name",
        "created_by",
        "publish_by",
        "unpublish_by",
        "created_date",
        "publish_date",
        "publish_down",
        "is_publish"
      ),
      Joi.string().valid("asc", "desc")
    )
    .length(1),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const searchInfographieSchema = Joi.object({
  searchText: Joi.string().allow("").required(),
  pageSize: Joi.number().integer().required().strict(),
  page: Joi.number().integer().required().strict(),
  order: Joi.object()
    .pattern(
      Joi.string().valid(
        "created_date",
        "description",
        "name",
        "created_by",
        "publish_by",
        "unpublish_by",
        "created_date",
        "publish_date",
        "publish_down",
        "is_publish"
      ),
      Joi.string().valid("asc", "desc")
    )
    .length(1),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const infographieIdSchema = Joi.object({
  infographieId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const updateInfographieSchema = Joi.object({
  infographieId: Joi.number().integer().required().strict(),
  name: Joi.string(),
  description: Joi.string(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
