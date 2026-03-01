import { renderDashboardPage } from "./pages/dashboard/dashboard.js";
import { renderIndexPage } from "./pages/index/index.js";

const routes = {
  "/": renderIndexPage,
  "/dashboard": renderDashboardPage
};

function normalizePath(pathname) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function initRouter(mountNode) {
  const pathname = normalizePath(window.location.pathname);
  const renderPage = routes[pathname] || routes["/"];
  renderPage(mountNode);
}
