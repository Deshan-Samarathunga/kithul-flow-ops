import { Router } from "express";
import { login, me, register } from "../controllers/authController.js";

const router = Router();

router.post("/register", register);

router.post("/login", login);

// Get current user from token
router.get("/me", me);

export default router;
