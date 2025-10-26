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
  ListCaptureWindowsFn,
  StartVideoCallFn,
  EndVideoCallFn,
  GetVideoCallStatusFn,
  FindPickleWindowsFn,
  ValidateWindowFn,
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
      // Video Call methods
      listCaptureWindows: ListCaptureWindowsFn;
      startVideoCall: StartVideoCallFn;
      endVideoCall: EndVideoCallFn;
      getVideoCallStatus: GetVideoCallStatusFn;
      findPickleWindows: FindPickleWindowsFn;
      validateWindow: ValidateWindowFn;
    };
  }
}
