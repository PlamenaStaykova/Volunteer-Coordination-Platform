import "./header.css";
import headerHtml from "./header.html?raw";

export function renderHeader(activePage) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = headerHtml;

  const activeLink = wrapper.querySelector(`[data-nav="${activePage}"]`);
  if (activeLink) {
    activeLink.classList.add("active");
  }

  return wrapper.firstElementChild;
}
