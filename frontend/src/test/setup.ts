import "@testing-library/jest-dom/vitest";

import "@ant-design/v5-patch-for-react-19";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

const getComputedStyle = window.getComputedStyle.bind(window);
Object.defineProperty(window, "getComputedStyle", {
  value: (element: Element) => getComputedStyle(element),
  configurable: true,
});

const locationMock = {
  href: "",
  pathname: "/login",
  assign: () => {},
  replace: () => {},
  reload: () => {},
};
Object.defineProperty(window, "location", {
  value: locationMock,
  writable: true,
  configurable: true,
});
