import Joi from "joi";

const customUrlValidator = (value, helpers) => {
  try {
    new URL(value);
    return value;
  } catch (error) {
    return helpers.error("string.uri");
  }
};

export const bannerSchema = Joi.object({
  name: Joi.string().required(),
  click_url: Joi.string().custom(customUrlValidator).required().messages({
    "string.uri": `Le lien doit être une URL valide (par exemple, https://example.com)`,
  }),
  is_publish: Joi.bool(),
  description: Joi.string().required(),
  publish_date: Joi.date().iso().when("publish_down", {
    is: Joi.exist(),
    then: Joi.required(), // publish_down is required if publish_date is present
    otherwise: Joi.optional(),
  }),
  publish_down: Joi.date().iso(),
  position: Joi.number().integer().min(1).max(7),
  categorieId: Joi.number().integer(),
  banner_type: Joi.string()
    .valid("MEGA_MENU", "ARTICLE_LIST")
    .when("categorieId", {
      is: Joi.exist(),
      then: Joi.required(), // banner_type is required if categorieId is present
      otherwise: Joi.optional(),
    }),
})
  .xor("position", "categorieId")
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const bannerIdSchema = Joi.object({
  bannerId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const updateBannerSchema = Joi.object({
  bannerId: Joi.number().integer().required().strict(),
  name: Joi.string(),
  click_url: Joi.string().custom(customUrlValidator).messages({
    "string.uri": `Le lien doit être une URL valide (par exemple, https://example.com)`,
  }),
  description: Joi.string(),
  publish_date: Joi.date().iso(),
  publish_down: Joi.date().iso(),
  position: Joi.number().integer().min(1).max(7),
  categorieId: Joi.number().integer(),
  banner_type: Joi.string()
    .valid("MEGA_MENU", "ARTICLE_LIST")
    .when("categorieId", {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
