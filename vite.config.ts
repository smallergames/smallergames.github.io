import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

function servePublicDirectories(): import("vite").Plugin {
  return {
    name: "serve-public-directories",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next();
        const clean = req.url.split("?")[0].replace(/\/$/, "");
        const candidate = path.join("public", clean, "index.html");
        if (clean && fs.existsSync(candidate)) {
          req.url = `${clean}/index.html`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [servePublicDirectories(), react()],
});
