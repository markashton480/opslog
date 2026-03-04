import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Fix for undici/react-router AbortSignal issue in JSDOM
if (typeof global.AbortSignal === "undefined") {
  global.AbortSignal = new AbortController().signal.constructor as any;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
