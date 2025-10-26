import express from "express";
import {
  DeleteImage,
  GetAllImages,
  GetAllImagesWithPaginations,
  GetAllIndexes,
  GetOneImage,
  SearchImages,
  UpdateImage,
  UploadImage,
} from "../controllers/imageController.js";
import {
  hasPrivilege,
  isAuthenticated,
} from "../middlewares/authMiddleware.js";

import {
  handleFileUploadError,
  singleUpload,
} from "../middlewares/uploadMiddleware.js";

const router = express.Router();
router.use(isAuthenticated);

router
  .route("/upload")
  .post(
    hasPrivilege("articles.view"),
    singleUpload.single("image"),
    handleFileUploadError,
    UploadImage
  );
router
  .route("/")
  .post(hasPrivilege("articles.view"), GetAllImagesWithPaginations)
  .put(hasPrivilege("articles.view"), UpdateImage);
router.route("/all").post(hasPrivilege("articles.view"), GetAllImages);
router.route("/image").post(hasPrivilege("articles.view"), GetOneImage);
router.route("/search").post(hasPrivilege("articles.view"), SearchImages);
router.route("/indexes").post(hasPrivilege("articles.view"), GetAllIndexes);
router.route("/delete").post(hasPrivilege("articles.view"), DeleteImage);
export default router;
