import { contextBridge } from "electron";
import { ipcRenderer } from "electron/renderer";
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
  ResearchEvent,
  GetTaskStatsFn,
  StartFaceTimeCallFn,
  GetDesktopSourcesFn,
  OnNavigateToCallFn,
  SetFaceTimeCallActiveFn,
  GetPromptConfigFn,
  GetLifetimeTaskStatsFn,
  AnalyzeUserEmailsFn,
  OnEmailAnalysisProgressFn,
  EmailAnalysisProgress,
  UploadConversationFn,
  UploadResearchSummaryFn,
  GenerateSystemPromptFn,
} from "@shared/types";

// The preload process plays a middleware role in bridging
// the call from the front end, and the function in the main process

if (!process.contextIsolated) {
  throw new Error("Context isolation must be enabled in the Browser window");
}

try {
  // Expose IPC send for popup window
  contextBridge.exposeInMainWorld("ipcRenderer", {
    send: (channel: string, data?: any) => ipcRenderer.send(channel, data),
  });

  // Front end can call the function by using window.context.<Function name>
  contextBridge.exposeInMainWorld("context", {
    getVersions: (...args: Parameters<GetVersionsFn>) =>
      ipcRenderer.invoke("getVersions", ...args),
    triggerIPC: () => ipcRenderer.invoke("triggerIPC"),
    startScreenCapture: (...args: Parameters<StartScreenCaptureFn>) =>
      ipcRenderer.invoke("startScreenCapture", ...args),
    stopScreenCapture: (...args: Parameters<StopScreenCaptureFn>) =>
      ipcRenderer.invoke("stopScreenCapture", ...args),
    getScreenCaptureStatus: (...args: Parameters<GetScreenCaptureStatusFn>) =>
      ipcRenderer.invoke("getScreenCaptureStatus", ...args),
    setScreenCaptureInterval: (...args: Parameters<SetScreenCaptureIntervalFn>) =>
      ipcRenderer.invoke("setScreenCaptureInterval", ...args),
    getScreenCaptureFolder: (...args: Parameters<GetScreenCaptureFolderFn>) =>
      ipcRenderer.invoke("getScreenCaptureFolder", ...args),
    signInWithGoogle: (...args: Parameters<SignInWithGoogleFn>) =>
      ipcRenderer.invoke("signInWithGoogle", ...args),
    performDeepResearch: (...args: Parameters<PerformDeepResearchFn>) =>
      ipcRenderer.invoke("performDeepResearch", ...args),
    onResearchEvent: (callback: OnResearchEventFn) => {
      const subscription = (_event: any, data: ResearchEvent) => callback(data);
      ipcRenderer.on('research-event', subscription);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener('research-event', subscription);
      };
    },
    onStatsUpdated: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('stats-updated', handler);
      return () => ipcRenderer.removeListener('stats-updated', handler);
    },
    getTaskStats: (...args: Parameters<GetTaskStatsFn>) =>
      ipcRenderer.invoke("getTaskStats", ...args),
    startFaceTimeCall: (...args: Parameters<StartFaceTimeCallFn>) =>
      ipcRenderer.invoke("startFaceTimeCall", ...args),
    getDesktopSources: (...args: Parameters<GetDesktopSourcesFn>) =>
      ipcRenderer.invoke("getDesktopSources", ...args),
    setFaceTimeCallActive: (...args: Parameters<SetFaceTimeCallActiveFn>) =>
      ipcRenderer.invoke("setFaceTimeCallActive", ...args),
    getPromptConfig: (...args: Parameters<GetPromptConfigFn>) =>
      ipcRenderer.invoke("getPromptConfig", ...args),
    onNavigateToCall: (callback: OnNavigateToCallFn) => {
      const subscription = () => callback();
      ipcRenderer.on('navigate-to-call', subscription);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener('navigate-to-call', subscription);
      };
    },
    getLifetimeTaskStats: (...args: Parameters<GetLifetimeTaskStatsFn>) =>
      ipcRenderer.invoke("getLifetimeTaskStats", ...args),
    analyzeUserEmails: (...args: Parameters<AnalyzeUserEmailsFn>) =>
      ipcRenderer.invoke("analyzeUserEmails", ...args),
    onEmailAnalysisProgress: (callback: OnEmailAnalysisProgressFn) => {
      const subscription = (_event: any, data: EmailAnalysisProgress) => callback(data);
      ipcRenderer.on('email-analysis-progress', subscription);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener('email-analysis-progress', subscription);
      };
    },
    uploadConversation: (...args: Parameters<UploadConversationFn>) =>
      ipcRenderer.invoke("uploadConversation", ...args),
    uploadResearchSummary: (...args: Parameters<UploadResearchSummaryFn>) =>
      ipcRenderer.invoke("uploadResearchSummary", ...args),
    generateSystemPrompt: (...args: Parameters<GenerateSystemPromptFn>) =>
      ipcRenderer.invoke("generateSystemPrompt", ...args),
  });
} catch (error) {
  console.error("Error occured when establishing context bridge: ", error);
}
