import "@testing-library/jest-dom/vitest";

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
