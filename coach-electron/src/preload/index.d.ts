import {
  GetVersionsFn,
  StartScreenCaptureFn,
  StopScreenCaptureFn,
  GetScreenCaptureStatusFn,
  SetScreenCaptureIntervalFn,
  GetScreenCaptureFolderFn,
  SignInWithGoogleFn,
  PerformDeepResearchFn,
  OnResearchEventFn,
  GetTaskStatsFn,
  StartFaceTimeCallFn,
  GetDesktopSourcesFn,
  OnNavigateToCallFn,
  SetFaceTimeCallActiveFn,
  GetPromptConfigFn,
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
      signInWithGoogle: SignInWithGoogleFn;
      performDeepResearch: PerformDeepResearchFn;
      onResearchEvent: (callback: OnResearchEventFn) => () => void;
      getTaskStats: GetTaskStatsFn;
      startFaceTimeCall: StartFaceTimeCallFn;
      getDesktopSources: GetDesktopSourcesFn;
      setFaceTimeCallActive: SetFaceTimeCallActiveFn;
      getPromptConfig: GetPromptConfigFn;
      onNavigateToCall: (callback: OnNavigateToCallFn) => () => void;
    };
    ipcRenderer: {
      send: (channel: string, data?: any) => void;
    };
  }
}
