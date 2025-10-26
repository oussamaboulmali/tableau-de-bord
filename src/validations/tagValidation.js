import Joi from "joi";

export const tagSchema = Joi.object({
  name: Joi.string().required(),
  alias: Joi.string().allow(""),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const tagIdSchema = Joi.object({
  tagId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const getTagOfArticleSchema = Joi.object({
  articleId: Joi.number().integer().strict(),
});

export const getTagsSchema = Joi.object({
  pageSize: Joi.number().integer().required().strict(),
  page: Joi.number().integer().required().strict(),
  order: Joi.object()
    .pattern(
      Joi.string().valid("created_date", "name", "created_by", "alias"),
      Joi.string().valid("asc", "desc")
    )
    .length(1),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const searchSchema = Joi.object({
  searchText: Joi.string().allow("").required(),
  pageSize: Joi.number().integer().required().strict().positive(),
  page: Joi.number().integer().required().strict().positive(),
  order: Joi.object()
    .pattern(
      Joi.string().valid("created_date", "name", "created_by", "alias"),
      Joi.string().valid("asc", "desc")
    )
    .length(1),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const updateTagSchema = Joi.object({
  tagId: Joi.number().integer().required().strict(),
  name: Joi.string().required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const changeStateTagSchema = Joi.object({
  tagId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
