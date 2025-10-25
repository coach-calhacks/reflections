import {
  GetVersionsFn,
  StartScreenCaptureFn,
  StopScreenCaptureFn,
  GetScreenCaptureStatusFn,
  SetScreenCaptureIntervalFn,
  GetScreenCaptureFolderFn,
} from "@shared/types";

// Type definition for the preload process
declare global {
  interface Window {
    context: {
      getVersions: GetVersionsFn;
      triggerIPC: () => void;
      startScreenCapture: StartScreenCaptureFn;
      stopScreenCapture: StopScreenCaptureFn;
      getScreenCaptureStatus: GetScreenCaptureStatusFn;
      setScreenCaptureInterval: SetScreenCaptureIntervalFn;
      getScreenCaptureFolder: GetScreenCaptureFolderFn;
    };
  }
}
