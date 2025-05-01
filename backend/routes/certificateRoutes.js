import express from "express";
import { generateCertificate } from "../controllers/certificateController.js"; // Correctly imported

const router = express.Router();

// Define route for certificate generation
router.post("/generate", generateCertificate);

export default router; // ✅ This ensures it is exported correctly
