import Joi from "joi";
// for url validation
const customUrlValidator = (value, helpers) => {
  try {
    new URL(value);
    return value;
  } catch (error) {
    return helpers.error("string.uri");
  }
};

export const articleSchema = Joi.object({
  categorieId: Joi.number().integer().required().strict().disallow(0),
  subCategorieId: Joi.number().integer().strict().disallow(0),
  imageId: Joi.number().integer().strict().disallow(0),
  gallerieId: Joi.number().integer().strict().disallow(0),
  dossierId: Joi.number().integer().strict().disallow(0),
  tags: Joi.array().items(Joi.number().integer().strict()),
  title: Joi.string().required(),
  supTitle: Joi.string().allow(""),
  introtext: Joi.string().required(),
  fulltext: Joi.string().allow(""),
  is_souverainete: Joi.boolean(),
  is_protected: Joi.boolean(),
  blockId: Joi.number().integer().strict().disallow(0),
  translatedArticles: Joi.array().items(
    Joi.object({
      url: Joi.string().custom(customUrlValidator).required(),
      id_lang: Joi.number().integer().strict().required().disallow(0),
    })
  ),
});
//  .messages({ "any.required": "Request body is required and cannot be empty" });

export const updateArticleSchema = Joi.object({
  articleId: Joi.number().integer().required().strict().disallow(0),
  categorieId: Joi.number().integer().strict().disallow(0),
  subCategorieId: Joi.number().integer().strict().disallow(0).allow(null),
  imageId: Joi.number().integer().strict().disallow(0),
  gallerieId: Joi.number().integer().strict().disallow(0),
  dossierId: Joi.number().integer().strict().disallow(0),
  tags: Joi.array().items(Joi.number().integer().strict().disallow(0)),
  title: Joi.string(),
  supTitle: Joi.string().allow(""),
  introtext: Joi.string(),
  fulltext: Joi.string().allow(""),
  is_souverainete: Joi.boolean(),
  is_protected: Joi.boolean(),
  blockId: Joi.number().integer().strict().disallow(0),
  translatedArticles: Joi.array().items(
    Joi.object({
      url: Joi.string().custom(customUrlValidator).required(),
      id_lang: Joi.number().integer().strict().required().disallow(0),
    })
  ),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const getArticleSchema = Joi.object({
  pageSize: Joi.number().integer().required().strict(),
  page: Joi.number().integer().required().strict(),
  order: Joi.object()
    .pattern(
      Joi.string().valid(
        "created_date",
        "title",
        "categorie",
        "views",
        "publish_date",
        "created_by",
        "publish_by"
      ),
      Joi.string().valid("asc", "desc")
    )
    .length(1),
  filter: Joi.object({
    is_trash: Joi.boolean(),
    is_publish: Joi.boolean(),
    is_pinned: Joi.boolean(),
    id_user: Joi.number().integer().strict(),
    id_categorie: Joi.number().integer().strict(),
    id_subCategorie: Joi.number().integer().strict(),
    id_tag: Joi.number().integer().strict(),
    id_dossier: Joi.number().integer().strict(),
    is_validated: Joi.boolean(),
  }),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const getArticlePubishedSchema = Joi.object({
  articleId: Joi.number().integer().required().strict().disallow(0),
  pageSize: Joi.number().integer().required().strict(),
  page: Joi.number().integer().required().strict(),
  order: Joi.object()
    .pattern(
      Joi.string().valid(
        "created_date",
        "title",
        "categorie",
        "views",
        "publish_date",
        "created_by",
        "publish_by"
      ),
      Joi.string().valid("asc", "desc")
    )
    .length(1),
  categorieId: Joi.number().integer().strict().disallow(0).when("blockId", {
    is: 3,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  subCategorieId: Joi.number()
    .integer()
    .strict()
    .disallow(0)
    .allow(null)
    .when("blockId", {
      is: 3,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  blockId: Joi.number().integer().strict().required().disallow(0),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const searchArticlePubishedSchema = Joi.object({
  articleId: Joi.number().integer().required().strict().disallow(0),
  searchText: Joi.string().allow("").required(),
  pageSize: Joi.number().integer().required().strict(),
  page: Joi.number().integer().required().strict(),
  order: Joi.object()
    .pattern(
      Joi.string().valid(
        "created_date",
        "title",
        "categorie",
        "views",
        "publish_date",
        "created_by",
        "publish_by"
      ),
      Joi.string().valid("asc", "desc")
    )
    .length(1),
  categorieId: Joi.number().integer().strict().disallow(0).when("blockId", {
    is: 3,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  subCategorieId: Joi.number()
    .integer()
    .strict()
    .disallow(0)
    .allow(null)
    .when("blockId", {
      is: 3,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  blockId: Joi.number().integer().strict().required().disallow(0),
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
      Joi.string().valid(
        "created_date",
        "title",
        "categorie",
        "views",
        "publish_date",
        "created_by",
        "publish_by"
      ),
      Joi.string().valid("asc", "desc")
    )
    .length(1),
  filter: Joi.object({
    is_trash: Joi.boolean(),
    is_publish: Joi.boolean(),
    is_pinned: Joi.boolean(),
    id_user: Joi.number().integer().strict(),
    id_categorie: Joi.number().integer().strict(),
    id_subCategorie: Joi.number().integer().strict(),
    id_tag: Joi.number().integer().strict(),
    id_dossier: Joi.number().integer().strict(),
    is_validated: Joi.boolean(),
  }),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const articleIdSchema = Joi.object({
  articleId: Joi.number().integer().required().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
export const articlePublishSchema = Joi.object({
  articleId: Joi.number().integer().required().strict(),
  publish_date: Joi.date().iso(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const articleUrlSchema = Joi.object({
  url: Joi.string().custom(customUrlValidator).required(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const articleGetBlocksSchema = Joi.object({
  categorieId: Joi.number().integer().strict().required(),
  subCategorieId: Joi.number().integer().strict(),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });

export const fetchaArticleHomeBlocksSchema = Joi.object({
  categorieId: Joi.number()
    .integer()
    .strict()
    .disallow(0)
    .allow(null)
    .when("subCategorieId", {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  subCategorieId: Joi.number().integer().strict().disallow(0).allow(null),
});

export const pinArticleSchema = Joi.object({
  articleId: Joi.number().integer().required().strict().disallow(0),
  categorieId: Joi.number().integer().strict().disallow(0).when("blockId", {
    is: 3,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  subCategorieId: Joi.number()
    .integer()
    .strict()
    .disallow(0)
    .allow(null)
    .when("blockId", {
      is: 3,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  is_pinned: Joi.boolean().required(),
  blockId: Joi.number().integer().strict().required().disallow(0),
  position: Joi.number().integer().strict().required().disallow(0),
})
  .min(1)
  .messages({
    "object.min": "Vous devez fournir au moins un champ.",
  });
