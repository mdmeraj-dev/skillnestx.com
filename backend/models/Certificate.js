import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";
import logger from "../utils/logger.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration from environment variables
const TEMPLATE_PATH = process.env.CERTIFICATE_TEMPLATE_PATH || path.join(__dirname, "../public/certificate-template.jpg");
const OUTPUT_DIR = process.env.CERTIFICATE_OUTPUT_DIR || path.join(__dirname, "../public/generated-certificates");

// Ensure output directory exists
async function ensureOutputDirectory() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (error) {
    logger.error(`Error creating output directory ${OUTPUT_DIR}: ${error.message}`);
    throw new Error(`Failed to create output directory: ${error.message}`);
  }
}

// Generate certificate image
async function generateCertificateImage(userName, courseName, completionDate) {
  try {
    // Validate inputs
    if (!userName || typeof userName !== "string" || userName.length > 50) {
      throw new Error("Invalid user name: must be a string up to 50 characters");
    }
    if (!courseName || typeof courseName !== "string" || courseName.length > 100) {
      throw new Error("Invalid course name: must be a string up to 100 characters");
    }
    if (!completionDate || typeof completionDate !== "string") {
      throw new Error("Invalid completion date: must be a string");
    }

    // Load template image
    const template = await loadImage(TEMPLATE_PATH);

    // Create canvas
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext("2d");

    // Draw template
    ctx.drawImage(template, 0, 0, canvas.width, canvas.height);

    // Set text properties
    ctx.fillStyle = "#000"; // Black color for text
    ctx.textAlign = "center"; // Center text for better alignment
    ctx.textBaseline = "middle";

    // User Name Placement
    ctx.font = "36px Arial";
    ctx.fillText(userName, canvas.width / 2, 270);

    // Course Name Placement
    ctx.font = "32px Arial";
    ctx.fillText(courseName, canvas.width / 2, 370);

    // Completion Date Placement
    ctx.font = "28px Arial";
    ctx.fillText(completionDate, canvas.width / 2, 470);

    // Generate unique filename
    const filename = `${userName.replace(/\s+/g, "_")}_${Date.now()}_certificate.jpg`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    // Ensure output directory exists
    await ensureOutputDirectory();

    // Save certificate
    const buffer = canvas.toBuffer("image/jpeg");
    await fs.writeFile(outputPath, buffer);

    logger.info(`Certificate generated: ${outputPath}`);
    return outputPath;
  } catch (error) {
    logger.error(`Error generating certificate image: ${error.message}`);
    throw new Error(`Failed to generate certificate image: ${error.message}`);
  }
}

export { generateCertificateImage };