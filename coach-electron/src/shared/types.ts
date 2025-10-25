import { electronAPI } from "@electron-toolkit/preload";
export type GetVersionsFn = () => Promise<typeof electronAPI.process.versions>;

// Screen capture types
export interface ScreenCaptureStatus {
  isCapturing: boolean;
  interval: number; // in seconds
  saveFolder: string;
  lastCaptureTime?: string;
}

export type StartScreenCaptureFn = (interval: number) => Promise<{ success: boolean; message: string }>;
export type StopScreenCaptureFn = () => Promise<void>;
export type GetScreenCaptureStatusFn = () => Promise<ScreenCaptureStatus>;
export type SetScreenCaptureIntervalFn = (interval: number) => Promise<void>;
export type GetScreenCaptureFolderFn = () => Promise<string>;

// Google Auth types
export interface GoogleAuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number;
  error?: string;
  userInfo?: {
    id: string;
    email: string;
    name: string;
    picture: string;
  };
}

export type SignInWithGoogleFn = () => Promise<GoogleAuthResult>;
