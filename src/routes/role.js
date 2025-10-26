import express from "express";
import {
  AddPrivilageToRole,
  AddUsersToRole,
  CreateRole,
  DeleteRole,
  GetAllPrivilages,
  GetAllRoles,
  GetOneRole,
  GetOtherPrivilages,
  GetUsersOfRole,
  GetUsersWithOtherRoles,
  RemovePrivilageFromRole,
  RemoveUsersFromRole,
  UpdateRole,
} from "../controllers/roleController.js";
import { hasRole, isAuthenticated } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(
  isAuthenticated,
  hasRole(["Admin", "SuperUser", "Rédacteur en chef"])
);

router.route("/").post(GetAllRoles);
router.post("/create", CreateRole);
router.post("/privileges", GetAllPrivilages);

router.post("/detail", GetOneRole);
router.put("/update", UpdateRole);
router.put("/delete", DeleteRole);

router.post("/other", GetUsersWithOtherRoles);

router.post("/users", GetUsersOfRole);

router.post("/users/add", AddUsersToRole);

router.put("/users/remove", RemoveUsersFromRole);

router.post("/otherprivileges", GetOtherPrivilages);
router.post("/privileges/add", AddPrivilageToRole);
router.put("/privileges/remove", RemovePrivilageFromRole);

export default router;
