import { Router } from "express";
import { auth, requireRole } from "../middleware/authMiddleware.js";
import {
  getRoles,
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  listCenters,
  getCenter,
  createCenter,
  updateCenter,
  deleteCenter,
} from "../controllers/adminController.js";

const router = Router();

router.use(auth, requireRole("Administrator"));

router.get("/roles", getRoles);

router.get("/users", listUsers);

router.get("/users/:userId", getUser);

router.post("/users", createUser);

router.patch("/users/:userId", updateUser);

router.delete("/users/:userId", deleteUser);

// Collection Centers Management
router.get("/centers", listCenters);

router.get("/centers/:centerId", getCenter);

router.post("/centers", createCenter);

router.patch("/centers/:centerId", updateCenter);

router.delete("/centers/:centerId", deleteCenter);

export default router;
