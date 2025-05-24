import jwt from "jsonwebtoken";
import crypto from "crypto";

/**
 * Generates a 6-digit OTP for email verification
 * @returns {string} 6-digit verification code
 */
export const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Generates an access token (JWT) and sets it as an HTTP-only cookie
 * @param {object} res - Express response object
 * @param {string} userId - User ID to include in the token
 * @returns {string} The generated JWT token
 */
export const generateAccessToken = (res, userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }

  const token = jwt.sign(
    { userId, purpose: "access" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("accessToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  });

  return token;
};

/**
 * Clears the access token cookie
 * @param {object} res - Express response object
 */
export const clearAccessToken = (res) => {
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
};