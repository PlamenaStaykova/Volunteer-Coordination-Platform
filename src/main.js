import "./styles/base.css";
import { initRouter } from "./router.js";

const app = document.querySelector("#app");
if (!app) {
  throw new Error("#app container was not found.");
}

initRouter(app);
