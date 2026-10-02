import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(cleanup);
// jsdom lacks pointer capture and transform layout used by Vaul; real drawer behavior is covered by Playwright.
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
Element.prototype.hasPointerCapture = () => false;
const computed = window.getComputedStyle.bind(window);
window.getComputedStyle = (element, pseudo) => {
  const style = computed(element, pseudo);
  if (!style.transform)
    Object.defineProperty(style, "transform", {
      value: "matrix(1, 0, 0, 1, 0, 0)",
    });
  return style;
};
