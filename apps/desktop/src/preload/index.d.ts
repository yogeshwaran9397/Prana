import type { PranaApi } from "./index.js";

declare global {
  interface Window {
    prana: PranaApi;
  }
}

export {};
