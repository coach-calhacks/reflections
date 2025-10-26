import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";

// Load environment variables from .env files
// Load .env.local first (takes priority), then .env
dotenv.config({ path: resolve(__dirname, ".env.local") });
dotenv.config({ path: resolve(__dirname, ".env") });

// Debug: Log if credentials are loaded (without exposing the actual values)
console.log("Google OAuth Config Status:");
console.log("  GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "✓ Loaded" : "✗ Missing");
console.log("  GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "✓ Loaded" : "✗ Missing");
console.log("  GOOGLE_REDIRECT_URI:", process.env.GOOGLE_REDIRECT_URI || "Using default: http://localhost");
console.log("  ELEVENLABS_AGENT_ID:", process.env.ELEVENLABS_AGENT_ID ? "✓ Loaded" : "✗ Missing");
console.log("Supabase Config Status:");
console.log("  SUPABASE_URL:", process.env.SUPABASE_URL ? "✓ Loaded" : "✗ Missing");
console.log("  SUPABASE_ANON_KEY:", process.env.SUPABASE_ANON_KEY ? "✓ Loaded" : "✗ Missing");

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@/lib": resolve("src/main/lib"),
        "@/shared": resolve("src/shared"),
      },
    },
    define: {
      "process.env.GOOGLE_CLIENT_ID": JSON.stringify(
        process.env.GOOGLE_CLIENT_ID
      ),
      "process.env.GOOGLE_CLIENT_SECRET": JSON.stringify(
        process.env.GOOGLE_CLIENT_SECRET
      ),
      "process.env.GOOGLE_REDIRECT_URI": JSON.stringify(
        process.env.GOOGLE_REDIRECT_URI || "http://localhost"
      ),
      "process.env.SUPABASE_URL": JSON.stringify(
        process.env.SUPABASE_URL
      ),
      "process.env.SUPABASE_ANON_KEY": JSON.stringify(
        process.env.SUPABASE_ANON_KEY
      ),
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@shared": resolve("src/shared"),
        "@/components": resolve("src/renderer/src/components"),
        "@/utils": resolve("src/renderer/src/utils"),
        "@/hooks": resolve("src/renderer/src/hooks"),
      },
    },
    define: {
      "import.meta.env.VITE_ELEVENLABS_AGENT_ID": JSON.stringify(
        process.env.ELEVENLABS_AGENT_ID
      ),
    },
    publicDir: resolve("src/renderer/public"),
    plugins: [react()],
  },
});
