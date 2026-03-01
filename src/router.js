import { renderDashboardPage } from "./pages/dashboard/dashboard.js";
import { renderCampaignPage } from "./pages/campaign/campaign.js";
import { renderIndexPage } from "./pages/index/index.js";
import { renderAuthPage } from "./pages/auth/auth.js";

const routes = {
  "/": renderIndexPage,
  "/dashboard": renderDashboardPage,
  "/dashboard/admin": renderDashboardPage,
  "/dashboard/organizer": renderDashboardPage,
  "/dashboard/volunteer": renderDashboardPage,
  "/auth": (mountNode) => renderAuthPage(mountNode, { defaultTab: "login" }),
  "/login": (mountNode) => renderAuthPage(mountNode, { defaultTab: "login" }),
  "/register": (mountNode) => renderAuthPage(mountNode, { defaultTab: "register" }),
};

function normalizePath(pathname) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export async function initRouter(mountNode) {
  const pathname = normalizePath(window.location.pathname);
  const campaignMatch = pathname.match(/^\/campaign\/([0-9a-fA-F-]+)$/);

  if (campaignMatch) {
    await renderCampaignPage(mountNode, { id: campaignMatch[1] });
    return;
  }

  const renderPage = routes[pathname] || routes["/"];
  await renderPage(mountNode);
}
