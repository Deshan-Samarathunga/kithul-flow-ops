import { Router } from "express";
import { login, me, register } from "../controllers/authController.js";

// Authentication entry points for registration, login, and token validation.
const router = Router();

router.post("/register", register);

router.post("/login", login);

// Return the currently authenticated user using the bearer token context.
router.get("/me", me);

export default router;
