import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function normalizeRequestPath(url: string) {
  return url.split("?")[0].replace(/\/+$/, "");
}

function servePublicDirectories(): import("vite").Plugin {
  return {
    name: "serve-public-directories",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) {
          next();
          return;
        }

        const requestPath = normalizeRequestPath(req.url);
        if (!requestPath || requestPath === "/") {
          next();
          return;
        }

        // Keep static artifact routes like /one available in dev.
        const candidate = path.join(server.config.publicDir, requestPath.slice(1), "index.html");
        if (fs.existsSync(candidate)) {
          req.url = `${requestPath}/index.html`;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [servePublicDirectories(), react()],
});
