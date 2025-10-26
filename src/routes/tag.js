import express from "express";
import {
  CreateTag,
  DeleteTag,
  GetAllTags,
  GetAllTagsWithPaginations,
  GetArticlesOfTag,
  SearchTags,
  UpdateTag,
} from "../controllers/tagController.js";
import {
  isAuthenticated,
  hasPrivilege,
} from "../middlewares/authMiddleware.js";

const router = express.Router();
// Apply authentication middleware to all routes
router.use(isAuthenticated);

router
  .route("/")
  .post(hasPrivilege("tags.view"), GetAllTagsWithPaginations)
  .put(hasPrivilege("tags.edit"), UpdateTag);
router.route("/all").post(hasPrivilege("tags.view"), GetAllTags);
router.route("/create").post(hasPrivilege("tags.create"), CreateTag);
router.route("/articles").post(hasPrivilege("articles.view"), GetArticlesOfTag);
router.route("/search").post(hasPrivilege("tags.view"), SearchTags);
router.route("/delete").post(hasPrivilege("tags.delete"), DeleteTag);

export default router;
