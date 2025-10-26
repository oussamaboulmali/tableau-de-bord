import express from "express";
import {
  ChangeStateGallery,
  CreateGallery,
  GetAllGalleriesWithPaginations,
  GetAllGallery,
  GetHomePageGalleries,
  GetOneGallery,
  GetOtherGalleriesPublished,
  GetPinnedGallery,
  PinGallery,
  SearchGallery,
  SearchOtherGalleriesPublished,
  UpdateGallery,
} from "../controllers/galleryController.js";
import {
  hasPrivilege,
  isAuthenticated,
} from "../middlewares/authMiddleware.js";
import {
  handleFileUploadError,
  multipleUpload,
} from "../middlewares/uploadMiddleware.js";

const router = express.Router();
router.use(isAuthenticated);

router
  .route("/")
  .post(hasPrivilege("gallery.view"), GetAllGalleriesWithPaginations);
router.route("/all").post(hasPrivilege("gallery.view"), GetAllGallery);
router.route("/pinned").post(hasPrivilege("gallery.pin"), GetPinnedGallery);
router.route("/home").post(hasPrivilege("gallery.pin"), GetHomePageGalleries);
router
  .route("/other")
  .post(hasPrivilege("gallery.pin"), GetOtherGalleriesPublished);
router.route("/pin").put(hasPrivilege("gallery.view"), PinGallery);
router
  .route("/update")
  .put(
    hasPrivilege("gallery.edit"),
    multipleUpload.array("gallery"),
    handleFileUploadError,
    UpdateGallery
  );
router.route("/detail").post(hasPrivilege("gallery.view"), GetOneGallery);
router
  .route("/create")
  .post(
    hasPrivilege("gallery.create"),
    multipleUpload.array("gallery"),
    handleFileUploadError,
    CreateGallery
  );
router.route("/state").put(hasPrivilege("gallery.publish"), ChangeStateGallery);
router.route("/search").post(hasPrivilege("gallery.view"), SearchGallery);
router
  .route("/searchother")
  .post(hasPrivilege("gallery.view"), SearchOtherGalleriesPublished);
export default router;
