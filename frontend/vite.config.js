import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    historyApiFallback: true,
  },
  build: {
    chunkSizeWarningLimit: 1000, 
    outDir: './dist', // Builds to frontend/dist
    emptyOutDir: true,
  },
  base: '/', // Critical for proper asset paths
});