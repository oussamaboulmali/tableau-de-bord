import express from "express";
import {
  AddAritclesToDossier,
  ChangeStateDossier,
  CreateDossier,
  GetAllDossier,
  GetOneDossier,
  GetOtherArticlesOfDossier,
  RemoveArticleFromDossier,
  SearchOtherArticlesOfDossier,
  UpdateDossier,
} from "../controllers/dossierController.js";
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

router.route("/").post(hasPrivilege("dossiers.view"), GetAllDossier);
router
  .route("/other")
  .post(hasPrivilege("dossiers.view"), GetOtherArticlesOfDossier);
router
  .route("/other/search")
  .post(hasPrivilege("dossiers.view"), SearchOtherArticlesOfDossier);
router
  .route("/update")
  .put(
    hasPrivilege("dossiers.edit"),
    singleUpload.single("dossier"),
    handleFileUploadError,
    UpdateDossier
  );
router.route("/detail").post(hasPrivilege("dossiers.view"), GetOneDossier);
router
  .route("/create")
  .post(
    hasPrivilege("dossiers.create"),
    singleUpload.single("dossier"),
    handleFileUploadError,
    CreateDossier
  );
router
  .route("/state")
  .put(hasPrivilege("dossiers.publish"), ChangeStateDossier);
router.post(
  "/articles/add",
  hasPrivilege("dossiers.articles"),
  AddAritclesToDossier
);
router.put(
  "/articles/remove",
  hasPrivilege("dossiers.articles"),
  RemoveArticleFromDossier
);

export default router;
