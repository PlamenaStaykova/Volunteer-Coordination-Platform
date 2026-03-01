import "./footer.css";
import footerHtml from "./footer.html?raw";

export function renderFooter() {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = footerHtml;
  return wrapper.firstElementChild;
}
