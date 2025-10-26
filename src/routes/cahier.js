import express from "express";
import {
  ChangeStateCahier,
  CreateCahier,
  GetAllCahier,
  GetAllCahierWithPaginations,
  GetOneCahier,
  SearchCahier,
  UpdateCahier,
} from "../controllers/cahierController.js";
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
  .post(hasPrivilege("cahiers.view"), GetAllCahierWithPaginations);
router.route("/all").post(hasPrivilege("cahiers.view"), GetAllCahier);
router
  .route("/update")
  .put(
    hasPrivilege("cahiers.edit"),
    multipleUpload.array("cahier"),
    handleFileUploadError,
    UpdateCahier
  );
router.route("/detail").post(hasPrivilege("cahiers.view"), GetOneCahier);
router
  .route("/create")
  .post(
    hasPrivilege("cahiers.create"),
    multipleUpload.array("cahier"),
    handleFileUploadError,
    CreateCahier
  );
router.route("/state").put(hasPrivilege("cahiers.publish"), ChangeStateCahier);
router.route("/search").post(hasPrivilege("cahiers.view"), SearchCahier);

export default router;
