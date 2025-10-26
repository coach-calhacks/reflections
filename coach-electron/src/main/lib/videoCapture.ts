import { desktopCapturer } from "electron";
import { showVideoCallPopup } from "./popupWindow";

export interface CaptureWindow {
  id: string;
  name: string;
  thumbnail?: string;
}

export interface VideoCallStatus {
  isActive: boolean;
  sourceId?: string;
  windowName?: string;
}

// Store current video call state
let currentVideoCall: VideoCallStatus = {
  isActive: false,
};

/**
 * Get list of available windows that can be captured
 */
export async function getAvailableWindows(): Promise<CaptureWindow[]> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 150, height: 150 },
      fetchWindowIcons: false,
    });

    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }));
  } catch (error) {
    console.error("Failed to get available windows:", error);
    throw new Error("Failed to get available windows. Check screen recording permissions.");
  }
}

/**
 * Start capturing a specific window for video call
 */
export async function startWindowCapture(sourceId: string): Promise<{ sourceId: string; windowName: string }> {
  try {
    // Verify the source still exists
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 150, height: 150 },
      fetchWindowIcons: false,
    });

    const targetSource = sources.find(source => source.id === sourceId);
    if (!targetSource) {
      throw new Error("Selected window no longer available");
    }

    // Update video call state
    currentVideoCall = {
      isActive: true,
      sourceId,
      windowName: targetSource.name,
    };

    console.log(`Started capturing window: ${targetSource.name} (${sourceId})`);
    
    // Show video call popup
    showVideoCallPopup({
      title: "Incoming Video Call",
      message: `From ${targetSource.name}`,
      sourceId,
      windowName: targetSource.name,
    });
    
    return {
      sourceId,
      windowName: targetSource.name,
    };
  } catch (error) {
    console.error("Failed to start window capture:", error);
    throw new Error(`Failed to start window capture: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Stop the current video call capture
 */
export function stopWindowCapture(): void {
  console.log("Stopping window capture");
  currentVideoCall = {
    isActive: false,
  };
}

/**
 * Get current video call status
 */
export function getVideoCallStatus(): VideoCallStatus {
  return { ...currentVideoCall };
}

/**
 * Check if a specific window is still available
 */
export async function isWindowAvailable(sourceId: string): Promise<boolean> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 150, height: 150 },
      fetchWindowIcons: false,
    });

    return sources.some(source => source.id === sourceId);
  } catch (error) {
    console.error("Failed to check window availability:", error);
    return false;
  }
}

/**
 * Find windows that might be Pickle application
 */
export async function findPickleWindows(): Promise<CaptureWindow[]> {
  try {
    const allWindows = await getAvailableWindows();
    
    // Look for windows that might be Pickle
    const pickleKeywords = ['pickle', 'lip', 'sync', 'avatar', 'talking', 'head'];
    
    return allWindows.filter(window => {
      const name = window.name.toLowerCase();
      return pickleKeywords.some(keyword => name.includes(keyword));
    });
  } catch (error) {
    console.error("Failed to find Pickle windows:", error);
    return [];
  }
}

/**
 * Validate that a window is suitable for capture
 */
export async function validateWindowForCapture(sourceId: string): Promise<{ valid: boolean; reason?: string }> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 150, height: 150 },
      fetchWindowIcons: false,
    });

    const targetSource = sources.find(source => source.id === sourceId);
    if (!targetSource) {
      return { valid: false, reason: "Window not found" };
    }

    // Check if window has reasonable size (not minimized)
    const thumbnail = targetSource.thumbnail;
    const size = thumbnail.getSize();
    
    if (size.width < 100 || size.height < 100) {
      return { valid: false, reason: "Window appears to be minimized or too small" };
    }

    return { valid: true };
  } catch (error) {
    console.error("Failed to validate window:", error);
    return { valid: false, reason: "Failed to validate window" };
  }
}
