import Joi from "joi";

export const dossierSchema = Joi.object({
  name: Joi.string().required(),
  articles: Joi.array().items(Joi.number().integer().strict()).min(1),
  description: Joi.string().required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const getDossiersSchema = Joi.object({
  pageSize: Joi.number().integer().required().strict(),
  page: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const dossierIdSchema = Joi.object({
  dossierId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const searchOtherArticlesOfDossierSchema = Joi.object({
  dossierId: Joi.number().integer().required().strict(),
  searchText: Joi.string().allow("").required(),
  pageSize: Joi.number().integer().required().strict().positive(),
  page: Joi.number().integer().required().strict().positive(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const otherArticlesOfDossierSchema = Joi.object({
  dossierId: Joi.number().integer().required().strict(),
  pageSize: Joi.number().integer().required().strict().positive(),
  page: Joi.number().integer().required().strict().positive(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const updateDossierSchema = Joi.object({
  dossierId: Joi.number().integer().required().strict().disallow(0),
  name: Joi.string(),
  description: Joi.string(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const updateDossierImageSchema = Joi.object({
  dossierId: Joi.number().integer().required().strict(),
  description: Joi.string(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const dossierArticlesSchema = Joi.object({
  dossierId: Joi.number().integer().required().strict(),
  articles: Joi.array()
    .items(Joi.number().integer().strict())
    .min(1)
    .required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const dossierArticlesRemoveSchema = Joi.object({
  dossierId: Joi.number().integer().required().strict(),
  articleId: Joi.number().integer().strict().required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
