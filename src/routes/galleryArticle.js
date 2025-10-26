import express from "express";
import {
  DeleteGallery,
  GetAllGalleries,
  GetAllGalleriesHaveNoArticles,
  GetOneGallery,
  GetOtherImagesOfGallery,
  SearchGalleries,
  UpdateGallery,
  UploadGallery,
} from "../controllers/galleryArticleController.js";
import multer from "multer";
import {
  hasPrivilege,
  isAuthenticated,
} from "../middlewares/authMiddleware.js";

const router = express.Router();
router.use(isAuthenticated);
const upload = multer({ dest: "tmp/" });

router
  .route("/upload")
  .post(hasPrivilege("articles.view"), upload.array("image"), UploadGallery);
router
  .route("/")
  .post(hasPrivilege("articles.view"), GetAllGalleriesHaveNoArticles)
  .put(hasPrivilege("articles.view"), UpdateGallery);
router.route("/all").post(hasPrivilege("articles.view"), GetAllGalleries);
router
  .route("/other")
  .post(hasPrivilege("articles.view"), GetOtherImagesOfGallery);
router.route("/search").post(hasPrivilege("articles.view"), SearchGalleries);
router.route("/gallery").post(hasPrivilege("articles.view"), GetOneGallery);
router.route("/delete").post(hasPrivilege("articles.view"), DeleteGallery);
export default router;
