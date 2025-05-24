import * as Jimp from "jimp";
import fs from "fs";
import path from "path";

export const generateCertificate = async (req, res) => {
  const traceId = req.headers["x-trace-id"] || Date.now().toString(36);
  try {
    const { userName, courseTitle, completedAt, courseId, userId } = req.body;

    if (!userName || !courseTitle || !completedAt) {
      return res.status(400).json({
        success: false,
        message: "userName, courseTitle, and completedAt are required",
        traceId,
      });
    }

    // Validate and format completedAt as DD-MM-YYYY
    let formattedDate;
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
    if (dateRegex.test(completedAt)) {
      // Already in DD-MM-YYYY format
      formattedDate = completedAt;
    } else {
      // Try parsing as ISO 8601 or other date string
      const parsedDate = new Date(completedAt);
      if (!isNaN(parsedDate.getTime())) {
        formattedDate = `${String(parsedDate.getDate()).padStart(2, "0")}-${String(
          parsedDate.getMonth() + 1
        ).padStart(2, "0")}-${parsedDate.getFullYear()}`;
      } else {
        // Invalid date, use current date and log warning
        console.warn(`Invalid date format for completedAt: ${completedAt}, using current date`, {
          traceId,
        });
        const date = new Date();
        formattedDate = `${String(date.getDate()).padStart(2, "0")}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}-${date.getFullYear()}`;
      }
    }

    // Load certificate template
    const templatePath = path.join(path.resolve(), "public/certificate-template.jpg");
    if (!fs.existsSync(templatePath)) {
      return res.status(500).json({
        success: false,
        message: "Certificate template not found",
        traceId,
      });
    }

    if (typeof Jimp.default?.read !== "function") {
      throw new Error("Jimp.default.read is not a function");
    }
    const image = await Jimp.default.read(templatePath);

    // Load fonts
    try {
      if (!Jimp.default?.FONT_SANS_64_BLACK || typeof Jimp.default?.FONT_SANS_64_BLACK !== "string") {
        throw new Error("FONT_SANS_64_BLACK is invalid or undefined");
      }
      if (!Jimp.default?.FONT_SANS_128_BLACK || typeof Jimp.default?.FONT_SANS_128_BLACK !== "string") {
        throw new Error("FONT_SANS_128_BLACK is invalid or undefined");
      }

      const fontSmall = await Jimp.default.loadFont(Jimp.default.FONT_SANS_64_BLACK);
      const fontLarge = await Jimp.default.loadFont(Jimp.default.FONT_SANS_128_BLACK);

      // Text Positioning
      const nameX = 825;
      const nameY = 335;
      image.print(fontSmall, nameX, nameY, userName);

      const courseX = 600;
      const courseY = 600;
      image.print(fontSmall, courseX, courseY, courseTitle);

      const dateX = 875;
      const dateY = 750;
      image.print(fontSmall, dateX, dateY, formattedDate);
    } catch (fontError) {
      console.error("Font loading error:", fontError);
      return res.status(500).json({
        success: false,
        message: `Failed to load fonts: ${fontError.message}`,
        traceId,
      });
    }

    // Define output directory
    const certificatesDir = path.join(path.resolve(), "public/generated-certificates");
    if (!fs.existsSync(certificatesDir)) {
      try {
        fs.mkdirSync(certificatesDir, { recursive: true });
      } catch (dirError) {
        console.error("Directory creation error:", dirError);
        return res.status(500).json({
          success: false,
          message: "Failed to create certificates directory",
          traceId,
        });
      }
    }

    // Generate file path
    const fileName = `${userName.replace(/\s+/g, "_")}_certificate.jpg`;
    const filePath = path.join(certificatesDir, fileName);

    // Save image
    await image.writeAsync(filePath);

    res.json({
      success: true,
      message: "Certificate generated successfully",
      data: { certificateUrl: `/generated-certificates/${fileName}` },
      traceId,
    });
  } catch (error) {
    console.error("Error generating certificate:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      traceId,
    });
  }
};