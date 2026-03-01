import "./styles/base.css";
import { initRouter } from "./router.js";

const app = document.querySelector("#app");
if (!app) {
  throw new Error("#app container was not found.");
}

initRouter(app).catch((error) => {
  console.error("Router initialization error:", error);
  app.textContent = "Unable to load the page. Please refresh and try again.";
});
