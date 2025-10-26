import express from "express";
import {
  ChangeStateInfographie,
  CreateInfographie,
  GetAllInfographie,
  GetAllInfographieWithPaginations,
  GetOneInfographie,
  SearchInfographie,
  UpdateInfographie,
} from "../controllers/infographieController.js";
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
  .route("/")
  .post(hasPrivilege("infographics.view"), GetAllInfographieWithPaginations);
router.route("/all").post(hasPrivilege("infographics.view"), GetAllInfographie);
router
  .route("/update")
  .put(
    hasPrivilege("infographics.edit"),
    singleUpload.single("infographie"),
    handleFileUploadError,
    UpdateInfographie
  );
router
  .route("/detail")
  .post(hasPrivilege("infographics.view"), GetOneInfographie);
router
  .route("/create")
  .post(
    hasPrivilege("infographics.create"),
    singleUpload.single("infographie"),
    handleFileUploadError,
    CreateInfographie
  );
router
  .route("/state")
  .put(hasPrivilege("infographics.publish"), ChangeStateInfographie);
router
  .route("/search")
  .post(hasPrivilege("infographics.view"), SearchInfographie);

export default router;
