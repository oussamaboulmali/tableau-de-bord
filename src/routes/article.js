import express from "express";

import {
  CreateArticle,
  FetchArticlesForBlock,
  GetAllArticles,
  GetBlocksWithPosition,
  GetLanguages,
  GetOneArticle,
  GetOtherArticlesPublished,
  GetReadMoreArticle,
  PinArticle,
  PublishArticle,
  SearchArticles,
  SearchOtherPublishedArticles,
  SendArticleToTrash,
  ToggleArticleLock,
  UnPublishArticle,
  UpdateArticle,
} from "../controllers/articleController.js";

import {
  hasPrivilege,
  isAuthenticated,
} from "../middlewares/authMiddleware.js";

const router = express.Router();
router.use(isAuthenticated);

router.route("/").post(hasPrivilege("articles.view"), GetAllArticles);
router
  .route("/other")
  .post(hasPrivilege("articles.view"), GetOtherArticlesPublished);
router
  .route("/searchother")
  .post(hasPrivilege("articles.view"), SearchOtherPublishedArticles);
router
  .route("/blocks")
  .post(hasPrivilege("articles.view"), GetBlocksWithPosition);
router
  .route("/homeblocks")
  .post(hasPrivilege("articles.view"), FetchArticlesForBlock);
router.route("/update").put(hasPrivilege("articles.edit"), UpdateArticle);
router.route("/lang").post(hasPrivilege("articles.view"), GetLanguages);
router.route("/create").post(hasPrivilege("articles.create"), CreateArticle);
router.route("/detail").post(hasPrivilege("articles.view"), GetOneArticle);
router
  .route("/readmore")
  .post(hasPrivilege("articles.view"), GetReadMoreArticle);
router.route("/search").post(hasPrivilege("articles.view"), SearchArticles);
router.route("/publish").put(hasPrivilege("articles.publish"), PublishArticle);
router
  .route("/unpublish")
  .put(hasPrivilege("articles.publish"), UnPublishArticle);
router.route("/trash").put(hasPrivilege("articles.trash"), SendArticleToTrash);
router.route("/pin").put(hasPrivilege("articles.pin"), PinArticle);
router.route("/lock").put(ToggleArticleLock);
export default router;
