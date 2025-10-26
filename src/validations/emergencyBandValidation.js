import Joi from "joi";

const customUrlValidator = (value, helpers) => {
  try {
    new URL(value);
    return value;
  } catch (error) {
    return helpers.error("string.uri");
  }
};

export const emergencyBandSchema = Joi.object({
  title: Joi.string().required(),
  click_url: Joi.string().custom(customUrlValidator).allow(null),
  is_publish: Joi.bool(),
  type: Joi.bool().required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const emergencybandIdSchema = Joi.object({
  emergencybandId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const updateBannerSchema = Joi.object({
  emergencybandId: Joi.number().integer().required().strict(),
  title: Joi.string(),
  click_url: Joi.string().custom(customUrlValidator).allow(null),
  type: Joi.bool(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
