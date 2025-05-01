import * as Jimp from "jimp"; // Namespace import
import fs from "fs";
import path from "path";

export const generateCertificate = async (req, res) => {
  try {
    console.log("Request body:", req.body);
    console.log("Jimp object:", Object.keys(Jimp));
    console.log("Jimp.default methods:", Object.keys(Jimp.default || {})); // Log default export methods
    console.log("Font constants:", {
      FONT_SANS_64_BLACK: Jimp.default?.FONT_SANS_64_BLACK,
      FONT_SANS_128_BLACK: Jimp.default?.FONT_SANS_128_BLACK,
    });
    const { name, course, completionDate } = req.body;

    if (!name || !course || !completionDate) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Load certificate template
    const templatePath = path.join(path.resolve(), "public/certificate-template.jpg");
    console.log("Template path:", templatePath);
    if (!fs.existsSync(templatePath)) {
      return res.status(500).json({ message: "Certificate template not found" });
    }

    if (typeof Jimp.default?.read !== "function") {
      throw new Error("Jimp.default.read is not a function");
    }
    const image = await Jimp.default.read(templatePath);
    console.log("Template loaded");

    // Load fonts
    try {
      // Validate font constants
      if (!Jimp.default?.FONT_SANS_64_BLACK || typeof Jimp.default?.FONT_SANS_64_BLACK !== "string") {
        throw new Error("FONT_SANS_64_BLACK is invalid or undefined");
      }
      if (!Jimp.default?.FONT_SANS_128_BLACK || typeof Jimp.default?.FONT_SANS_128_BLACK !== "string") {
        throw new Error("FONT_SANS_128_BLACK is invalid or undefined");
      }

      const fontSmall = await Jimp.default.loadFont(Jimp.default.FONT_SANS_64_BLACK);
      console.log("Font small loaded");
      const fontLarge = await Jimp.default.loadFont(Jimp.default.FONT_SANS_128_BLACK);
      console.log("Font large loaded");

      // Text Positioning
      const nameX = 825;
      const nameY = 340;
      image.print(fontLarge, nameX, nameY, name);

      const courseX = image.bitmap.width / 2 - Jimp.default.measureText(fontLarge, course) / 2;
      const courseY = 600;
      image.print(fontLarge, courseX, courseY, course);

      const dateX = 925;
      const dateY = 750;
      image.print(fontSmall, dateX, dateY, completionDate);
    } catch (fontError) {
      console.error("Font loading error:", fontError);
      return res.status(500).json({ message: `Failed to load fonts: ${fontError.message}` });
    }

    // Define output directory
    const certificatesDir = path.join(path.resolve(), "public/generated-certificates");
    console.log("Certificates dir:", certificatesDir);
    if (!fs.existsSync(certificatesDir)) {
      try {
        fs.mkdirSync(certificatesDir, { recursive: true });
        console.log("Directory created");
      } catch (dirError) {
        console.error("Directory creation error:", dirError);
        return res.status(500).json({ message: "Failed to create certificates directory" });
      }
    }

    // Generate file path
    const fileName = `${name.replace(/\s+/g, "_")}_certificate.jpg`;
    const filePath = path.join(certificatesDir, fileName);
    console.log("File path:", filePath);

    // Save image
    await image.writeAsync(filePath);
    console.log("Certificate saved");

    res.json({
      message: "Certificate generated successfully",
      certificateUrl: `/generated-certificates/${fileName}`,
    });
  } catch (error) {
    console.error("Error generating certificate:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};