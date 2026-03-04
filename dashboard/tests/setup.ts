import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Fix for undici/react-router AbortSignal issue in JSDOM
const g = globalThis as any;
if (typeof g.AbortSignal === "undefined" && typeof g.AbortController !== "undefined") {
  g.AbortSignal = new g.AbortController().signal.constructor as any;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
