import Joi from "joi";

export const categorieSchema = Joi.object({
  name: Joi.string().required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const subCategorieSchema = Joi.object({
  categorieId: Joi.number().integer().required().strict(),
  subCategories: Joi.array().items(Joi.number().integer().strict()),
  names: Joi.array().items(Joi.string()),
})
  .or("subCategories", "names")
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const updateCategorieSchema = Joi.object({
  categorieId: Joi.number().integer().required().strict(),
  name: Joi.string(),
  alias: Joi.string(),
})
  .or("name", "alias")
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const setDefaultCategorieSchema = Joi.object({
  categorieId: Joi.number().integer().required().strict(),
  subCategorieId: Joi.number().integer().required().strict().allow(null),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const changeStateCategorieSchema = Joi.object({
  categorieId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const updateSubCategorieSchema = Joi.object({
  subCategorieId: Joi.number().integer().required().strict(),
  name: Joi.string(),
  alias: Joi.string(),
})
  .or("name", "alias")
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const subCategorieIdSchema = Joi.object({
  subCategorieId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
