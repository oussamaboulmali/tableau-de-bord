import express from "express";
import {
  AddSubCategorie,
  ChangeStateCategorie,
  ChangeStateSubCategorie,
  CreateCategorie,
  GetAllCategories,
  GetAllCategoriesWithSubCategories,
  GetDefaultCategory,
  GetOtherSubCategories,
  GetSubCategoriesOFcategorie,
  SetDefaultCategory,
  UpdateCategorie,
  UpdateSubCategorie,
} from "../controllers/categorieController.js";

import {
  hasPrivilege,
  isAuthenticated,
} from "../middlewares/authMiddleware.js";

const router = express.Router();
router.use(isAuthenticated);

router
  .route("/")
  .post(hasPrivilege("categories.view"), GetAllCategories)
  .put(hasPrivilege("categories.edit"), UpdateCategorie);
router
  .route("/state")
  .put(hasPrivilege("categories.activate"), ChangeStateCategorie);
router
  .route("/create")
  .post(hasPrivilege("categories.create"), CreateCategorie);
router
  .route("/sub")
  .post(hasPrivilege("subcategories.view"), GetSubCategoriesOFcategorie);
router
  .route("/sub/other")
  .post(hasPrivilege("subcategories.view"), GetOtherSubCategories);
router
  .route("/sub/add")
  .post(hasPrivilege("subcategories.create"), AddSubCategorie);
router
  .route("/sub/state")
  .put(hasPrivilege("subcategories.activate"), ChangeStateSubCategorie);
router
  .route("/sub/update")
  .put(hasPrivilege("subcategories.edit"), UpdateSubCategorie);

router
  .route("/default")
  .post(hasPrivilege("categories.default"), GetDefaultCategory);
router
  .route("/setdefault")
  .post(hasPrivilege("categories.default"), SetDefaultCategory);

router
  .route("/all")
  .post(hasPrivilege("categories.view"), GetAllCategoriesWithSubCategories);
export default router;
