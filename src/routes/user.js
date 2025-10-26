import express from "express";

import {
  CreateUser,
  GetAllUsers,
  GetOneUser,
  ResetUserPassword,
  ChangeUserPassword,
  UnblockUser,
  UpdateUser,
  AddRoleToUser,
  RemoveRolesFromUser,
  ActivateUser,
  GetOtherRolesOfUser,
  GetAllMenu,
  BlockUser,
  BlockIpAdress,
  GetAllConfigurations,
  ChangeStateConfiguration,
  GetDashboardStats,
  UpdateLoggedUser,
  CreateForbiddenWords,
  DeleteForbiddenWords,
  GetAllForbidenWords,
} from "../controllers/userController.js";

import {
  hasPrivilege,
  isAuthenticated,
} from "../middlewares/authMiddleware.js";

const router = express.Router();
router.use(isAuthenticated);

//router.route("/").post( GetAllUsers);
router.route("/").post(hasPrivilege("users.view"), GetAllUsers);
router.post("/stats", GetDashboardStats);
router.post("/forbidden-words", GetAllForbidenWords);
router.post("/forbidden-words/create", CreateForbiddenWords);
router.put("/forbidden-words/delete", DeleteForbiddenWords);

router.post("/menu", GetAllMenu);

router
  .route("/roles")
  .post(hasPrivilege("users.view"), AddRoleToUser)
  .put(hasPrivilege("users.view"), RemoveRolesFromUser);
router.post("/create", hasPrivilege("users.create"), CreateUser);
router.post("/detail", hasPrivilege("users.view"), GetOneUser);
router.post("/other", hasPrivilege("users.view"), GetOtherRolesOfUser);
router.put("/update", hasPrivilege("users.edit"), UpdateUser);
router.put("/updateme", hasPrivilege("users.edit.self"), UpdateLoggedUser);
router.put("/activate", hasPrivilege("users.activate"), ActivateUser);
router.put("/block", hasPrivilege("users.block"), BlockUser);
router.put("/blockip", BlockIpAdress);
router.put("/unblock", hasPrivilege("users.block"), UnblockUser);
router.put("/reset", hasPrivilege("users.reset"), ResetUserPassword);
router.put(
  "/changepassword",
  hasPrivilege("users.edit.self"),
  ChangeUserPassword
);

router.post(
  "/confs",
  hasPrivilege("configurations.view"),
  GetAllConfigurations
);
router.put(
  "/confs",
  hasPrivilege("configurations.activate"),
  ChangeStateConfiguration
);

export default router;
