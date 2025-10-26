import { BrowserWindow, screen, ipcMain } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";

let popupWindow: BrowserWindow | null = null;
let isPopupActive = false;

interface PopupOptions {
  title: string;
  message: string;
}

export function isPopupOpen(): boolean {
  return isPopupActive && popupWindow !== null && !popupWindow.isDestroyed();
}

export function showPopupWindow(options: PopupOptions): void {
  // Close existing popup if one is open
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close();
  }

  const { title, message } = options;
  isPopupActive = true;

  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  // Popup window dimensions (FaceTime-style)
  const windowWidth = 343;
  const windowHeight = 193;
  
  // Position in top-right corner with some padding
  const padding = 20;
  const x = screenWidth - windowWidth - padding;
  const y = padding;

  // Create the popup window
  popupWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    show: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    transparent: true,
    roundedCorners: false,
    vibrancy: undefined,
    ...(process.platform === 'darwin' && {
      vibrancy: 'fullscreen-ui',
      visualEffectState: 'active'
    }),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the popup HTML
  const queryParams = new URLSearchParams({
    title: encodeURIComponent(title),
    message: encodeURIComponent(message),
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    popupWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/popup.html?${queryParams}`);
  } else {
    popupWindow.loadFile(join(__dirname, "../renderer/popup.html"), {
      query: Object.fromEntries(queryParams),
    });
  }

  // Show window when ready
  popupWindow.once("ready-to-show", () => {
    popupWindow?.show();
  });

  // Clean up reference when closed
  popupWindow.on("closed", () => {
    popupWindow = null;
    isPopupActive = false;
  });
}

// Set up IPC handlers for popup actions
ipcMain.on("popup-pickup-call", async (event) => {
  // Close the popup window
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close();
  }
  
  // Trigger the FaceTime call in the main window
  const mainWindows = BrowserWindow.getAllWindows().filter(w => w !== popupWindow);
  if (mainWindows.length > 0) {
    const mainWindow = mainWindows[0];
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('navigate-to-call');
  }
});

ipcMain.on("popup-end-call", () => {
  // Just close the popup window
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close();
  }
});

export function closePopupWindow(): void {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close();
  }
}

