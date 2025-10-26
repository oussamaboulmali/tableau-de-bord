import { ErrorHandler } from "../middlewares/errorMiddleware.js";
import { ValidationError } from "../middlewares/errorMiddleware.js";
import {
  addSubCategorieToCategorie,
  changeStateCategorie,
  changeStateSubCategorie,
  createCategorie,
  getAllCategories,
  getAllCategoriesWithSubCategorie,
  getDefaultCategorie,
  getOtherSubCategories,
  getSubCategoriesOFcategorie,
  setDefaultCategory,
  updateCategorie,
  updateSubCategorie,
} from "../services/categorieService.js";
import { infoLogger, createLogEntry } from "../utils/logger.js";
import { tryCatch } from "../utils/tryCatch.js";
import {
  categorieSchema,
  changeStateCategorieSchema,
  setDefaultCategorieSchema,
  subCategorieIdSchema,
  subCategorieSchema,
  updateCategorieSchema,
  updateSubCategorieSchema,
} from "../validations/categorieValidation.js";

// Logger instance for logging category-related actions
const logger = infoLogger("catégories");

// Custom log function to format log messages with request details and action
const customLog = (req, options = {}) => {
  const { message, action, err } = options;

  // Get base log entry from createLogEntry
  const baseLogEntry = createLogEntry(req, err);

  // Add custom fields
  return {
    ...baseLogEntry,
    action: action || null,
    username: req.session?.username || null,
    ...(message && { message }),
  };
};
// Controller function to get all categories
export const GetAllCategories = tryCatch(async (req, res) => {
  // Retrieve all categories from the service
  const data = await getAllCategories();

  // Respond with success message and category data
  return res.status(200).json({
    success: true,
    message: "Categories Successfully fetched",
    data,
  });
});

// Controller function to get all categories with subCategorie
export const GetAllCategoriesWithSubCategories = tryCatch(async (req, res) => {
  // Retrieve all categories with subCategorie from the service
  const {
    categoriesFormatted: data,
    defaultCategorieId,
    defaultSubCategorieId,
  } = await getAllCategoriesWithSubCategorie(req.body);

  // Respond with success message and category data
  return res.status(200).json({
    success: true,
    message: "Categories/SubCategorie Successfully fetched",
    data,
    defaultCategorieId,
    defaultSubCategorieId,
  });
});

// Controller function to create a new category
export const CreateCategorie = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = categorieSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the createCategorie service function to create a new category
  const data = await createCategorie(
    {
      ...req.body,
      id_session: req.session.sessionId,
      id_user: req.session.userId,
      created_by: req.session.username,
    },
    customLog(req, { action: "creation" })
  );

  // Log category creation
  logger.info(
    customLog(req, {
      message: `Une nouvelle catégorie "${req.body.name}" a été créée. `,
      action: "creation",
    })
  );

  // Respond with success message and created category data
  return res.status(201).json({
    success: true,
    message: "Une catégorie créée avec succès.",
    data,
  });
});

// Controller function to update a category
export const UpdateCategorie = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = updateCategorieSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the category and retrieve its name
  const categorieName = await updateCategorie(
    {
      ...req.body,
      modifiedBy: req.session.username,
    },
    customLog(req, { action: "modification" })
  );

  // Update the category and retrieve its name
  logger.info(
    customLog(req, {
      message: `la catégorie "${categorieName}" a été modifiée avec succés en ${req.body.name}/${req.body.alias}.`,
      action: "modification",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "Une catégorie modifié avec succès.",
  });
});

export const SetDefaultCategory = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = setDefaultCategorieSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the default category and retrieve its name
  const { categorieName, subCategorieName } = await setDefaultCategory(
    {
      ...req.body,
      modifiedBy: req.session.username,
    },
    customLog(req, { action: "modification catégorie par défaut" })
  );

  // Update the category and retrieve its name
  logger.info(
    customLog(req, {
      message: `la catégorie par défaut a été modifiée avec succés par catégorie ${categorieName} ${
        subCategorieName
          ? "et la sous-catégorie " + subCategorieName
          : "sans sous-catégorie par défaut "
      }.`,
      action: "modification catégorie par défaut",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "Catégorie par défaut modifié avec succès.",
  });
});

export const GetDefaultCategory = tryCatch(async (req, res) => {
  // Update the default category and retrieve its name
  const data = await getDefaultCategorie();

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "Catégorie par défaut avec succès.",
    data,
  });
});
// Controller function to change the state of a category (activate/deactivate)
export const ChangeStateCategorie = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = changeStateCategorieSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Change the state of the category and retrieve its name and new state
  const { name, state } = await changeStateCategorie(
    {
      ...req.body,
      changeBy: req.session.username,
    },
    customLog(req)
  );

  // Log category state change
  logger.info(
    customLog(req, {
      message: `La catégorie : "${name}" a été ${
        state ? "desactivé" : "activé"
      } avec succés.`,
      action: `${state ? "desactivation" : "activation"}`,
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "L'état du catégorie a été modifié avec succés.",
  });
});

export const AddSubCategorie = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = subCategorieSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Call the createCategorie service function to create a new category
  const { subCategories: data, categorieName } =
    await addSubCategorieToCategorie(
      {
        ...req.body,
        id_session: req.session.sessionId,
        id_user: req.session.userId,
        created_by: req.session.username,
      },
      customLog(req, { action: "attribuer sous-categorie/categorie" })
    );

  // Log category creation
  logger.info(
    customLog(req, {
      message: `Les sous-catégorie [ ${data.map(
        (subCategorie) => subCategorie.name
      )} ] ont été attribués à la catégorie ${categorieName} avec succés `,
      action: "attribuer sous-categorie/categorie",
    })
  );

  // Respond with success message and created category data
  return res.status(201).json({
    success: true,
    message:
      "Les sous-catégories ont été attribués à la catégorie avec succès.",
    data,
  });
});

// Controller function to update a category
export const UpdateSubCategorie = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = updateSubCategorieSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the category and retrieve its name
  const categorieName = await updateSubCategorie(
    {
      ...req.body,
      modifiedBy: req.session.username,
    },
    customLog(req, { action: "modification" })
  );

  // Update the category and retrieve its name
  logger.info(
    customLog(req, {
      message: `la catégorie "${categorieName}" a été modifiée avec succés en ${req.body.name}/${req.body.alias}.`,
      action: "modification",
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "Une catégorie modifié avec succès.",
  });
});

// Controller function to change the state of a category (activate/deactivate)
export const ChangeStateSubCategorie = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = subCategorieIdSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Change the state of the category and retrieve its name and new state
  const { name, state } = await changeStateSubCategorie(
    {
      ...req.body,
      changeBy: req.session.username,
    },
    customLog(req)
  );

  // Log category state change
  logger.info(
    customLog(req, {
      message: `La catégorie : "${name}" a été ${
        state ? "desactivé" : "activé"
      } avec succés.`,
      action: `${state ? "desactivation" : "activation"}`,
    })
  );

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "L'état du catégorie a été modifié avec succés.",
  });
});

export const GetOtherSubCategories = tryCatch(async (req, res) => {
  const { error } = changeStateCategorieSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the category and retrieve its name
  const data = await getOtherSubCategories(req.body);

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "SubCategories Successfully fetched",
    data,
  });
});

export const GetSubCategoriesOFcategorie = tryCatch(async (req, res) => {
  // Validate the request body against schema
  const { error } = changeStateCategorieSchema.validate(req.body);

  // Throw an error if validation fails
  if (error) {
    throw new ValidationError(
      `Input validation error ${
        process.env.NODE_ENV !== "production" ? error.details[0].message : ""
      } `,
      error.details[0].message
    );
  }

  // Update the category and retrieve its name
  const data = await getSubCategoriesOFcategorie(req.body);

  // Respond with success message
  return res.status(201).json({
    success: true,
    message: "SubCategories Successfully fetched",
    data,
  });
});
