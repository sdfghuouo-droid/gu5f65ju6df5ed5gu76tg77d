const VITE_API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export const API_BASE: string =
  VITE_API_BASE ||
  (import.meta.env.BASE_URL ? `${import.meta.env.BASE_URL}api` : "api");

export const API_ORIGIN: string = (() => {
  try {
    return VITE_API_BASE ? new URL(API_BASE).origin : window.location.origin;
  } catch {
    return window.location.origin;
  }
})();