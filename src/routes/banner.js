import express from "express";
import {
  ChangeStateBanner,
  CreateBanner,
  GetAllBanners,
  GetOneBanner,
  UpdateBanner,
} from "../controllers/bannerController.js";
import {
  handleFileUploadError,
  singleUpload,
} from "../middlewares/uploadMiddleware.js";
import {
  hasPrivilege,
  isAuthenticated,
} from "../middlewares/authMiddleware.js";

const router = express.Router();
router.use(isAuthenticated);

router.route("/").post(hasPrivilege("banners.view"), GetAllBanners);
router
  .route("/update")
  .put(
    hasPrivilege("banners.edit"),
    singleUpload.single("banniere"),
    handleFileUploadError,
    UpdateBanner
  );
router.route("/detail").post(hasPrivilege("banners.view"), GetOneBanner);
router
  .route("/create")
  .post(
    hasPrivilege("banners.create"),
    singleUpload.single("banniere"),
    handleFileUploadError,
    CreateBanner
  );
router.route("/state").put(hasPrivilege("banners.publish"), ChangeStateBanner);

export default router;
