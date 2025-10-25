import { vi } from "vitest";

const context = Object.defineProperty(window, "context", {
  writable: true,
  value: {
    getVersions: vi.fn().mockImplementation(() => ({
      electron: "0.0",
      chrome: "0.0",
      node: "0.0",
    })),
    triggerIPC: vi.fn().mockImplementation(() => {}),
    startScreenCapture: vi.fn().mockImplementation(() => 
      Promise.resolve({ success: true, message: "Screen capture started" })
    ),
    stopScreenCapture: vi.fn().mockImplementation(() => Promise.resolve()),
    getScreenCaptureStatus: vi.fn().mockImplementation(() => 
      Promise.resolve({
        isCapturing: false,
        interval: 10,
        saveFolder: "/mock/folder",
      })
    ),
    setScreenCaptureInterval: vi.fn().mockImplementation(() => Promise.resolve()),
    getScreenCaptureFolder: vi.fn().mockImplementation(() => 
      Promise.resolve("/mock/folder")
    ),
  },
});

export { context };
