import { electronAPI } from "@electron-toolkit/preload";
import { desktopCapturer, systemPreferences } from "electron";
import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import {
  GetVersionsFn,
  StartScreenCaptureFn,
  StopScreenCaptureFn,
  GetScreenCaptureStatusFn,
  SetScreenCaptureIntervalFn,
  GetScreenCaptureFolderFn,
  SignInWithGoogleFn,
} from "@shared/types";
import { signInWithGoogle as googleAuthSignIn } from "./googleAuth";

// Thie file stores functions used for the front-end
// to communicate with the main process directly

export const getVersions: GetVersionsFn = async () => {
  const versions = electronAPI.process.versions;
  return versions;
};

export const triggerIPC = () => {
  console.log("IPC invoked in console");
};

// Screen capture state
let captureInterval: NodeJS.Timeout | null = null;
let captureSettings = {
  isCapturing: false,
  interval: 10, // default 10 seconds
  lastCaptureTime: undefined as string | undefined,
};

const SETTINGS_FILE = "screen-capture-settings.json";
const SCREENSHOT_FOLDER = "CoachScreenshots";

// Get the screenshot save folder path
const getScreenshotFolder = (): string => {
  const picturesPath = app.getPath("pictures");
  return path.join(picturesPath, SCREENSHOT_FOLDER);
};

// Ensure screenshot folder exists
const ensureScreenshotFolder = (): void => {
  const folder = getScreenshotFolder();
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
};

// Load settings from disk
const loadSettings = (): void => {
  try {
    const settingsPath = path.join(app.getPath("userData"), SETTINGS_FILE);
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf-8");
      const loaded = JSON.parse(data);
      captureSettings.interval = loaded.interval || 10;
      captureSettings.isCapturing = loaded.isCapturing || false;
    }
  } catch (error) {
    console.error("Failed to load screen capture settings:", error);
  }
};

// Save settings to disk
const saveSettings = (): void => {
  try {
    const settingsPath = path.join(app.getPath("userData"), SETTINGS_FILE);
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        interval: captureSettings.interval,
        isCapturing: captureSettings.isCapturing,
      }),
      "utf-8"
    );
  } catch (error) {
    console.error("Failed to save screen capture settings:", error);
  }
};

// Check and request screen capture permissions (macOS)
const checkScreenCapturePermissions = async (): Promise<boolean> => {
  if (process.platform === "darwin") {
    const status = systemPreferences.getMediaAccessStatus("screen");
    console.log(`macOS Screen Recording permission status: ${status}`);
    
    if (status !== "granted") {
      console.log("Screen Recording permission not granted. Please grant permission in System Preferences > Security & Privacy > Screen Recording");
      return false;
    }
  }
  return true;
};

// Capture a single screenshot
const captureScreenshot = async (): Promise<void> => {
  try {
    ensureScreenshotFolder();
    
    // Get all available screen sources
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 3840, height: 2160 }, // 4K resolution
      fetchWindowIcons: false,
    });

    if (sources.length === 0) {
      console.error("No screen sources available");
      console.error("This might be due to missing screen recording permissions on macOS");
      return;
    }

    // Get the primary screen (first screen)
    const primaryScreen = sources[0];
    console.log(`Capturing screen: ${primaryScreen.name}`);
    const thumbnail = primaryScreen.thumbnail;

    // Get the actual size
    const size = thumbnail.getSize();
    console.log(`Screenshot size: ${size.width}x${size.height}`);

    // Convert to PNG buffer
    const imageBuffer = thumbnail.toPNG();

    // Generate filename with timestamp
    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/T/, "_")
      .replace(/:/g, "-")
      .split(".")[0];
    const filename = `screenshot_${timestamp}.png`;
    const filepath = path.join(getScreenshotFolder(), filename);

    // Save to disk
    fs.writeFileSync(filepath, imageBuffer);
    captureSettings.lastCaptureTime = now.toISOString();
    
    console.log(`Screenshot saved: ${filepath}`);
  } catch (error) {
    console.error("Failed to capture screenshot:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Stack:", error.stack);
    }
  }
};

// Start screen capture
export const startScreenCapture: StartScreenCaptureFn = async (interval) => {
  try {
    // Check permissions first
    const hasPermission = await checkScreenCapturePermissions();
    if (!hasPermission) {
      return {
        success: false,
        message: "Screen Recording permission required. Please enable it in System Preferences > Security & Privacy > Screen Recording",
      };
    }

    // Stop any existing capture
    if (captureInterval) {
      clearInterval(captureInterval);
      captureInterval = null;
    }

    // Validate interval
    if (interval < 1) {
      return {
        success: false,
        message: "Interval must be at least 1 second",
      };
    }

    captureSettings.interval = interval;
    captureSettings.isCapturing = true;
    saveSettings();

    // Take first screenshot immediately
    await captureScreenshot();

    // Set up interval for subsequent captures
    captureInterval = setInterval(() => {
      captureScreenshot();
    }, interval * 1000);

    return {
      success: true,
      message: "Screen capture started successfully",
    };
  } catch (error) {
    console.error("Failed to start screen capture:", error);
    return {
      success: false,
      message: `Failed to start screen capture: ${error}`,
    };
  }
};

// Stop screen capture
export const stopScreenCapture: StopScreenCaptureFn = async () => {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  captureSettings.isCapturing = false;
  saveSettings();
};

// Get current capture status
export const getScreenCaptureStatus: GetScreenCaptureStatusFn = async () => {
  return {
    isCapturing: captureSettings.isCapturing,
    interval: captureSettings.interval,
    saveFolder: getScreenshotFolder(),
    lastCaptureTime: captureSettings.lastCaptureTime,
  };
};

// Set capture interval
export const setScreenCaptureInterval: SetScreenCaptureIntervalFn = async (
  interval
) => {
  if (interval < 1) {
    throw new Error("Interval must be at least 1 second");
  }
  
  captureSettings.interval = interval;
  saveSettings();

  // If currently capturing, restart with new interval
  if (captureSettings.isCapturing && captureInterval) {
    clearInterval(captureInterval);
    captureInterval = setInterval(() => {
      captureScreenshot();
    }, interval * 1000);
  }
};

// Get screenshot folder path
export const getScreenCaptureFolder: GetScreenCaptureFolderFn = async () => {
  return getScreenshotFolder();
};

// Initialize on app start
export const initializeScreenCapture = (): void => {
  loadSettings();
  
  // Auto-start if it was previously enabled
  if (captureSettings.isCapturing) {
    console.log("Auto-starting screen capture from previous session");
    startScreenCapture(captureSettings.interval);
  }
};

// Google OAuth
export const signInWithGoogle: SignInWithGoogleFn = async () => {
  return googleAuthSignIn();
};
