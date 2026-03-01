import "./dashboard.css";
import pageHtml from "./dashboard.html?raw";
import { renderHeader } from "../../components/header/header.js";
import { renderFooter } from "../../components/footer/footer.js";

export function renderDashboardPage(mountNode) {
  document.title = "Volunteer Coordination Platform - Dashboard";
  mountNode.innerHTML = "";
  mountNode.append(renderHeader("dashboard"));

  const pageContainer = document.createElement("div");
  pageContainer.innerHTML = pageHtml;
  mountNode.append(pageContainer.firstElementChild);

  mountNode.append(renderFooter());
}
