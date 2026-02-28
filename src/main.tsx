import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";

function restoreRouteFrom404Redirect() {
  const url = new URL(window.location.href);
  const redirectedRoute = url.searchParams.get("__sg_route");
  if (!redirectedRoute) {
    return;
  }

  let target: URL;
  try {
    target = new URL(redirectedRoute, window.location.origin);
  } catch {
    return;
  }

  if (target.origin !== window.location.origin) {
    return;
  }

  const normalizedPath = target.pathname.replace(/\/+$/, "") || "/";
  const restoredPath = `${normalizedPath}${target.search}${target.hash}`;
  window.history.replaceState(window.history.state, "", restoredPath);
}

restoreRouteFrom404Redirect();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
