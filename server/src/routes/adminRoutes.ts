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

// Administrative management endpoints covering roles, users, and centers.
const router = Router();

// Ensure every route below is accessed by authenticated administrators.
router.use(auth, requireRole("Administrator"));

// Role catalogue for building the user-role UI.
router.get("/roles", getRoles);

// User management CRUD endpoints.
router.get("/users", listUsers);

router.get("/users/:userId", getUser);

router.post("/users", createUser);

router.patch("/users/:userId", updateUser);

router.delete("/users/:userId", deleteUser);

// Collection center CRUD endpoints.
router.get("/centers", listCenters);

router.get("/centers/:centerId", getCenter);

router.post("/centers", createCenter);

router.patch("/centers/:centerId", updateCenter);

router.delete("/centers/:centerId", deleteCenter);

export default router;
