import { app, shell, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import {
  getVersions,
  triggerIPC,
  startScreenCapture,
  stopScreenCapture,
  getScreenCaptureStatus,
  setScreenCaptureInterval,
  getScreenCaptureFolder,
  initializeScreenCapture,
  signInWithGoogle,
  performDeepResearch,
} from "@/lib";
import {
  GetVersionsFn,
  StartScreenCaptureFn,
  StopScreenCaptureFn,
  GetScreenCaptureStatusFn,
  SetScreenCaptureIntervalFn,
  GetScreenCaptureFolderFn,
  SignInWithGoogleFn,
  PerformDeepResearchFn,
} from "@shared/types";

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false, // Changed from true - needed for desktopCapturer
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // IPC events
  ipcMain.handle(
    "getVersions",
    (_, ...args: Parameters<GetVersionsFn>) => getVersions(...args)
  );

  ipcMain.handle("triggerIPC", () => triggerIPC());

  // Screen capture IPC events
  ipcMain.handle(
    "startScreenCapture",
    (_, ...args: Parameters<StartScreenCaptureFn>) => startScreenCapture(...args)
  );

  ipcMain.handle(
    "stopScreenCapture",
    (_, ...args: Parameters<StopScreenCaptureFn>) => stopScreenCapture(...args)
  );

  ipcMain.handle(
    "getScreenCaptureStatus",
    (_, ...args: Parameters<GetScreenCaptureStatusFn>) => getScreenCaptureStatus(...args)
  );

  ipcMain.handle(
    "setScreenCaptureInterval",
    (_, ...args: Parameters<SetScreenCaptureIntervalFn>) => setScreenCaptureInterval(...args)
  );

  ipcMain.handle(
    "getScreenCaptureFolder",
    (_, ...args: Parameters<GetScreenCaptureFolderFn>) => getScreenCaptureFolder(...args)
  );

  // Google OAuth IPC event
  ipcMain.handle(
    "signInWithGoogle",
    (_, ...args: Parameters<SignInWithGoogleFn>) => signInWithGoogle(...args)
  );

  // Web Deep Research IPC event
  ipcMain.handle(
    "performDeepResearch",
    async (event, ...args: Parameters<PerformDeepResearchFn>) => {
      // Set up event callback to send events back to renderer
      const onEvent = (researchEvent: any) => {
        event.sender.send('research-event', researchEvent);
      };
      
      return performDeepResearch(args[0], onEvent);
    }
  );

  // Initialize screen capture (auto-start if previously enabled)
  initializeScreenCapture();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
