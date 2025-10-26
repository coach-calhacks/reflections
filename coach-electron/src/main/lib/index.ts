import { electronAPI } from "@electron-toolkit/preload";
import { desktopCapturer, systemPreferences, Notification } from "electron";
import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
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
import { showPopupWindow, isPopupOpen } from "./popupWindow";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

// Initialize Gemini AI client
let genAI: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== "your_api_key_here") {
    genAI = new GoogleGenAI({ apiKey });
    console.log("Gemini AI client initialized successfully");
  } else {
    console.warn("GEMINI_API_KEY not found or not set. Screenshot analysis will be skipped.");
    console.warn("Please set your API key in the .env file to enable Gemini analysis.");
  }
} catch (error) {
  console.error("Failed to initialize Gemini AI client:", error);
}

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
try {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("Supabase client initialized successfully");
  } else {
    console.warn("SUPABASE_URL or SUPABASE_ANON_KEY not found. Stats tracking will be skipped.");
    console.warn("Please set your Supabase credentials in the .env file to enable stats tracking.");
  }
} catch (error) {
  console.error("Failed to initialize Supabase client:", error);
}

// Store logged in user's email
let userEmail: string | null = null;

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
  interval: 18, // default 18 seconds
  lastCaptureTime: undefined as string | undefined,
};
let isAnalyzing = false; // Flag to prevent concurrent analyses

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
      captureSettings.interval = loaded.interval || 18;
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

// Define the function declaration tool for Gemini
const checkUserFocusTool = {
  functionDeclarations: [{
    name: "check_user_focus",
    description: "Determines if the user is locked in (focused on productive applications) or distracted, whether they are working on the same task as before, and categorizes the task type",
    parameters: {
      type: Type.OBJECT,
      properties: {
        is_locked_in: {
          type: Type.BOOLEAN,
          description: "True if user is on productive/work apps, False if on distracting apps"
        },
        user_activity_description: {
          type: Type.STRING,
          description: "Description of what the user is currently doing (e.g., 'coding in VS Code', 'browsing social media', 'watching YouTube')"
        },
        same_task: {
          type: Type.BOOLEAN,
          description: "True if the current activity is a similar task to the previous activity, False if it's a different task or context has changed"
        },
        task_category: {
          type: Type.STRING,
          description: "Category of the task: 'analytical' (coding, math proofs, algorithm design, debugging), 'creative' (composing music, design, brainstorming), 'reading' (textbooks, blogs, instructions), 'social media' (facebook, twitter, reddit, instagram, linkedin), 'watching' (netflix, youtube, other media not on social media), 'conversation' (email, video call), or 'other' (if doesn't fit)",
          enum: ["Analytical", "Creative", "Reading", "Social Media", "Watching", "Conversation", "Other"]
        }
      },
      required: ["is_locked_in", "user_activity_description", "same_task", "task_category"]
    }
  }]
};

// Helper function to get most recent activity description from Supabase
// Used only for providing context to Gemini AI for same_task detection
const getMostRecentActivity = async (email: string): Promise<{ description: string } | null> => {
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('stats')
      .select('description')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // If no rows found, that's okay (user's first activity)
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching most recent activity:', error);
      return null;
    }

    return data ? { description: data.description } : null;
  } catch (error) {
    console.error('Failed to fetch most recent activity:', error);
    return null;
  }
};

// Analyze screenshot with Gemini AI
const analyzeScreenshotWithGemini = async (filepath: string): Promise<void> => {
  // Check if popup is open (user needs to respond first)
  if (isPopupOpen()) {
    console.log("Popup is open, skipping screenshot analysis");
    return;
  }

  // Check if another analysis is already running
  if (isAnalyzing) {
    console.log("Analysis already in progress, skipping this screenshot to prevent race conditions");
    return;
  }

  if (!genAI) {
    console.log("Gemini AI not initialized. Skipping screenshot analysis.");
    return;
  }

  // Set flag to prevent concurrent analyses
  isAnalyzing = true;

  try {
    // Fetch most recent activity if user is logged in for Gemini context
    let previousActivityDescription: string | null = null;
    if (userEmail) {
      const previousData = await getMostRecentActivity(userEmail);
      if (previousData) {
        previousActivityDescription = previousData.description;
        console.log(`Previous activity: ${previousData.description}`);
      }
    }

    // Read the image file and convert to base64
    const imageBuffer = fs.readFileSync(filepath);
    const base64Image = imageBuffer.toString("base64");

    // Prepare the prompt and image
    let prompt = "Analyze this screenshot and determine if the user is 'locked in' (focused on productive work like coding, writing, professional tools, learning, etc.) or distracted (social media, entertainment, gaming, shopping, etc.).";
    
    if (previousActivityDescription) {
      prompt += ` The user's previous activity was: "${previousActivityDescription}". Determine if the current activity is the same task or a different task.`;
    } else {
      prompt += " This is the first activity being tracked.";
    }
    
    prompt += " Call the check_user_focus function with your assessment.";

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: "image/png",
      },
    };

    // Generate content using Gemini with function calling (with timeout)
    const GEMINI_TIMEOUT_MS = 30000; // 30 second timeout
    const geminiPromise = genAI.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [prompt, imagePart],
      config: {
        tools: [checkUserFocusTool],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
      },
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gemini API timeout after 30 seconds')), GEMINI_TIMEOUT_MS);
    });

    const result = await Promise.race([geminiPromise, timeoutPromise]) as Awaited<typeof geminiPromise>;

    // Check if the model made a function call
    const functionCalls = result.functionCalls;
    
    if (functionCalls && functionCalls.length > 0) {
      const functionCall = functionCalls[0];
      if (functionCall.name === "check_user_focus") {
        const { is_locked_in, user_activity_description, same_task, task_category } = functionCall.args as { 
          is_locked_in: boolean;
          user_activity_description: string;
          same_task: boolean;
          task_category: string;
        };
        
        // Output the results to terminal
        console.log(`Is locked in: ${is_locked_in}`);
        console.log(`User activity: ${user_activity_description}`);
        console.log(`Same task: ${same_task}`);
        console.log(`Task category: ${task_category}`);
        
        // Insert stats into Supabase if user is logged in
        if (userEmail && supabase) {
          try {
            // Use atomic database function to prevent race conditions
            const { data, error: insertError } = await supabase
              .rpc('insert_activity_stat', {
                p_email: userEmail,
                p_description: user_activity_description,
                p_on_goal: is_locked_in,
                p_seconds: captureSettings.interval,
                p_task: task_category,
                p_same_task: same_task
              })
              .single();

            if (insertError) {
              console.error('Error inserting stats:', insertError);
            } else if (data) {
              const result = data as { new_id: string; new_seq_time: number };
              console.log(`Stats inserted successfully - ID: ${result.new_id}, seq_time: ${result.new_seq_time}`);
            }
          } catch (statsError) {
            console.error('Failed to insert stats:', statsError);
          }
        } else {
          if (!userEmail) {
            console.warn('User not logged in, skipping stats insertion');
          }
          if (!supabase) {
            console.warn('Supabase not initialized, skipping stats insertion');
          }
        }
        
        // Only send notification if user is NOT locked in
        if (!is_locked_in) {
          new Notification({
            title: "Focus Alert",
            body: `You are not locked in! ${user_activity_description}`
          }).show();
          
          // Also show popup window
          showPopupWindow({
            title: "Focus Alert",
            message: `You are not locked in! ${user_activity_description}`
          });
        }
      }
    }

  } catch (error) {
    console.error("Failed to analyze screenshot with Gemini:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
  } finally {
    // Always reset the flag, even if there was an error
    isAnalyzing = false;
  }
};

// Capture a single screenshot
const captureScreenshot = async (): Promise<void> => {
  // Skip if popup is currently open (user needs to respond first)
  if (isPopupOpen()) {
    console.log("Popup is open, skipping screenshot capture");
    return;
  }

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

    // Check if thumbnail is empty
    if (size.width === 0 || size.height === 0) {
      console.warn("Screenshot is empty (0x0), skipping...");
      return;
    }

    // Convert to PNG buffer
    const imageBuffer = thumbnail.toPNG();

    // Additional check: verify the image buffer has reasonable size
    // Empty/blank screenshots are typically very small (< 1KB)
    if (imageBuffer.length < 1000) {
      console.warn(`Screenshot buffer too small (${imageBuffer.length} bytes), likely empty. Skipping...`);
      return;
    }

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

    // Analyze screenshot with Gemini AI
    await analyzeScreenshotWithGemini(filepath);
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
  const result = await googleAuthSignIn();
  
  // Store user email if sign-in was successful
  if (result.success && result.userInfo?.email) {
    userEmail = result.userInfo.email;
    console.log(`User email stored: ${userEmail}`);
  }
  
  return result;
};

// Web Deep Research
export { performDeepResearch } from './webResearch';

// Get task statistics from Supabase
export const getTaskStats = async (): Promise<any[]> => {
  if (!supabase) {
    console.warn("Supabase client not initialized. Returning empty stats.");
    return [];
  }

  try {
    // Use SQL aggregation to sum up seconds per task category
    const { data, error } = await supabase.rpc('get_task_stats');

    if (error) {
      console.error("Error fetching stats from Supabase:", error);
      return [];
    }

    console.log("Task stats fetched:", data);
    return data || [];
  } catch (error) {
    console.error("Error fetching task stats:", error);
    return [];
  }
};
