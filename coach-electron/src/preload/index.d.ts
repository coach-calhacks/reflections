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
  GetLifetimeTaskStatsFn,
  AnalyzeUserEmailsFn,
  OnEmailAnalysisProgressFn,
  UploadConversationFn,
  UploadResearchSummaryFn,
  GenerateSystemPromptFn,
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
      onStatsUpdated: (callback: () => void) => () => void;
      getLifetimeTaskStats: GetLifetimeTaskStatsFn;
      analyzeUserEmails: AnalyzeUserEmailsFn;
      onEmailAnalysisProgress: (callback: OnEmailAnalysisProgressFn) => () => void;
      uploadConversation: UploadConversationFn;
      uploadResearchSummary: UploadResearchSummaryFn;
      generateSystemPrompt: GenerateSystemPromptFn;
    };
  }
}
