// src/utils/auth.js

// Simulate JWT decoding (replace with your actual JWT decoding logic)
export function isAdmin() {
  const token = localStorage.getItem("token"); // Get the JWT from localStorage
  if (!token) return false; // No token = not authenticated

  // Decode the token (this is a placeholder; use a library like jwt-decode in a real app)
  const decodedToken = JSON.parse(atob(token.split(".")[1]));

  // Check if the user is an admin
  return decodedToken.role === "admin";
}