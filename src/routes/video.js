import express from "express";
import {
  ChangeStateVideo,
  CreateArchive,
  CreateVideo,
  GetAllVideo,
  GetAllVideoWithPaginations,
  GetHomePageVideos,
  GetOneVideo,
  GetOtherVideosPublished,
  GetPinnedVedio,
  PinVideo,
  SearchOtherVideosPublished,
  SearchVideo,
  SwapMainVideo,
  UpdateVideo,
} from "../controllers/videoController.js";
import {
  hasPrivilege,
  isAuthenticated,
} from "../middlewares/authMiddleware.js";

import {
  handleFileUploadError,
  singleUpload,
} from "../middlewares/uploadMiddleware.js";

const router = express.Router();
router.route("/archive").post(singleUpload.single("archive"), CreateArchive);

router.use(isAuthenticated);

router.route("/").post(hasPrivilege("video.view"), GetAllVideoWithPaginations);
router.route("/all").post(hasPrivilege("video.view"), GetAllVideo);
router.route("/pinned").post(hasPrivilege("video.pin"), GetPinnedVedio); // test if you can delete it
router.route("/home").post(hasPrivilege("video.pin"), GetHomePageVideos);
router.route("/pin").put(hasPrivilege("video.pin"), PinVideo);
router
  .route("/update")
  .put(
    hasPrivilege("video.edit"),
    singleUpload.single("video"),
    handleFileUploadError,
    UpdateVideo
  );
router.route("/detail").post(hasPrivilege("video.view"), GetOneVideo);
router
  .route("/create")
  .post(
    hasPrivilege("video.create"),
    singleUpload.single("video"),
    handleFileUploadError,
    CreateVideo
  );
router.route("/state").put(hasPrivilege("video.publish"), ChangeStateVideo);
router.route("/search").post(hasPrivilege("video.view"), SearchVideo);
router.route("/other").post(hasPrivilege("video.pin"), GetOtherVideosPublished);
router
  .route("/searchother")
  .post(hasPrivilege("video.view"), SearchOtherVideosPublished);
router.route("/main").put(hasPrivilege("video.main"), SwapMainVideo);
export default router;
