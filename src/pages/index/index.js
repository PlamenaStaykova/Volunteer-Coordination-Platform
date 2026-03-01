import "./index.css";
import pageHtml from "./index.html?raw";
import { renderHeader } from "../../components/header/header.js";
import { renderFooter } from "../../components/footer/footer.js";

export async function renderIndexPage(mountNode) {
  document.title = "Volunteer Coordination Platform - Home";
  mountNode.innerHTML = "";
  mountNode.append(await renderHeader("home"));

  const pageContainer = document.createElement("div");
  pageContainer.innerHTML = pageHtml;
  mountNode.append(pageContainer.firstElementChild);

  mountNode.append(renderFooter());
}
