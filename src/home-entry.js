import "./styles/base.css";
import { renderIndexPage } from "./pages/index/index.js";

const app = document.querySelector("#app");
if (!app) {
  throw new Error("#app container was not found.");
}

renderIndexPage(app).catch((error) => {
  console.error("Home page initialization error:", error);
  app.textContent = "Unable to load the page. Please refresh and try again.";
});
