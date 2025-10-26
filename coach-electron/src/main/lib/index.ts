import { electronAPI } from "@electron-toolkit/preload";
import { desktopCapturer, systemPreferences, Notification, BrowserWindow } from "electron";
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
  ConversationData,
  ConversationUploadResult,
  ResearchResponse,
  ResearchUploadResult,
  ResearchSummary,
  SystemPromptResult,
  SystemPrompt,
} from "@shared/types";
import { signInWithGoogle as googleAuthSignIn } from "./googleAuth";
import { showPopupWindow, isPopupOpen } from "./popupWindow";
import { performEmailAnalysis, EmailAnalysisResult, AnalysisProgress } from "./composioAnalysis";

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
  sessionStartAt: undefined as string | undefined,
  sessionEndAt: undefined as string | undefined,
};
let isAnalyzing = false; // Flag to prevent concurrent analyses
let stopRequested = false; // Flag to abort in-flight analyses

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

// Helper to notify all renderer windows
const broadcastStatsUpdated = (): void => {
  try {
    const windows = BrowserWindow.getAllWindows();
    console.log(`[Main] broadcastStatsUpdated: notifying ${windows.length} windows`);
    windows.forEach((w) => {
      w.webContents.send('stats-updated');
      console.log('[Main] sent stats-updated to a window');
    });
  } catch (notifyErr) {
    console.warn('Failed to broadcast stats-updated event:', notifyErr);
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
    // Check if stop was requested before starting
    if (stopRequested) {
      console.log('Stop requested, aborting analysis');
      return;
    }

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

    // Check if stop was requested after Gemini completes
    if (stopRequested) {
      console.log('Stop requested after analysis, skipping result processing');
      return;
    }

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
        // Re-check capturing state: if stopped while analysis was running, skip insert
        if (!captureSettings.isCapturing || stopRequested) {
          console.log('Capture has been stopped. Skipping stats insert for completed analysis.');
          return;
        }
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
              // Notify all renderer windows that stats have been updated
              broadcastStatsUpdated();
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

    // Reset stop flag for new session
    stopRequested = false;
    console.log('[startScreenCapture] New session started. stopRequested reset to false.');

    captureSettings.interval = interval;
    captureSettings.isCapturing = true;
    captureSettings.sessionStartAt = new Date().toISOString();
    captureSettings.sessionEndAt = undefined;
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
  stopRequested = true; // Signal any in-flight analysis to abort
  captureSettings.sessionEndAt = new Date().toISOString();
  console.log('[stopScreenCapture] Stop requested. isAnalyzing:', isAnalyzing, 'sessionEndAt:', captureSettings.sessionEndAt);
  saveSettings();
  
  // Wait for in-flight analysis to complete and abort gracefully
  // Poll up to 5 seconds in case Gemini is still running
  const maxWaitMs = 5000;
  const pollInterval = 100;
  const startTime = Date.now();
  while (isAnalyzing && (Date.now() - startTime) < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    console.log('[stopScreenCapture] Waiting for analysis to complete... isAnalyzing:', isAnalyzing);
  }
  
  if (isAnalyzing) {
    console.warn('[stopScreenCapture] Analysis still running after 5s timeout, proceeding anyway');
  }
  
  console.log('[stopScreenCapture] Analysis complete. Broadcasting stats update.');
  // Let renderer refresh status & stats immediately
  broadcastStatsUpdated();
  
  // Do NOT reset stopRequested here—keep it set until next session starts
  // This ensures any lingering analysis won't insert stats
};

// Get current capture status
export const getScreenCaptureStatus: GetScreenCaptureStatusFn = async () => {
  return {
    isCapturing: captureSettings.isCapturing,
    interval: captureSettings.interval,
    saveFolder: getScreenshotFolder(),
    lastCaptureTime: captureSettings.lastCaptureTime,
    sessionStartAt: captureSettings.sessionStartAt,
    sessionEndAt: captureSettings.sessionEndAt,
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
    // Get session window bounds
    const sinceIso = captureSettings.sessionStartAt;
    const untilIso = captureSettings.sessionEndAt;
    
    console.log('[getTaskStats] Session window:', { sinceIso, untilIso });

    // If we have a session start time, filter by it; otherwise return all stats
    const query = supabase.from('stats').select('task, seconds, created_at');
    
    let filteredQuery = query;
    if (sinceIso) {
      filteredQuery = filteredQuery.gte('created_at', sinceIso);
      console.log('[getTaskStats] Added filter: created_at >= ', sinceIso);
    }
    if (untilIso) {
      filteredQuery = filteredQuery.lte('created_at', untilIso);
      console.log('[getTaskStats] Added filter: created_at <= ', untilIso);
    }

    const { data: rows, error } = await filteredQuery.order('created_at', { ascending: true });
    
    if (error) {
      console.error("Error fetching stats from Supabase:", error);
      return [];
    }

    console.log('[getTaskStats] Raw rows fetched:', rows?.length || 0, rows);

    if (!rows || rows.length === 0) {
      console.warn('[getTaskStats] No stats rows found in session window. Returning empty dataset.');
      // Return empty data structure for all categories
      const categories = ['Analytical', 'Conversation', 'Creative', 'Reading', 'Social Media', 'Watching'];
      return categories.map((task) => ({
        task,
        count: 0,
        total_seconds: 0,
        total_hours: 0,
      }));
    }

    // Aggregate seconds by task
    const byTask: Record<string, { count: number; total_seconds: number }> = {};
    const categories = ['Analytical', 'Conversation', 'Creative', 'Reading', 'Social Media', 'Watching'];
    
    for (const category of categories) {
      byTask[category] = { count: 0, total_seconds: 0 };
    }

    for (const r of rows) {
      const task = r.task as string;
      if (byTask[task]) {
        byTask[task].count += 1;
        byTask[task].total_seconds += r.seconds || 0;
      }
    }

    const aggregated = categories.map((task) => ({
      task,
      count: byTask[task].count,
      total_seconds: byTask[task].total_seconds,
      total_hours: byTask[task].total_seconds / 3600,
    }));

    console.log('[getTaskStats] Aggregated stats:', aggregated);
    return aggregated;
  } catch (error) {
    console.error("Error fetching task stats:", error);
    return [];
  }
};

// Get lifetime task statistics from Supabase (all-time data for logged-in user)
export const getLifetimeTaskStats = async (): Promise<any[]> => {
  if (!supabase) {
    console.warn("Supabase client not initialized. Returning empty stats.");
    return [];
  }

  try {
    console.log('[getLifetimeTaskStats] Fetching all-time stats for user:', userEmail);

    // Fetch all stats for the logged-in user (no session filtering)
    const { data: rows, error } = await supabase
      .from('stats')
      .select('task, seconds, created_at')
      .eq('email', userEmail)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error("Error fetching lifetime stats from Supabase:", error);
      return [];
    }

    console.log('[getLifetimeTaskStats] Raw rows fetched:', rows?.length || 0);

    if (!rows || rows.length === 0) {
      console.warn('[getLifetimeTaskStats] No lifetime stats found. Returning empty dataset.');
      // Return empty data structure for all categories
      const categories = ['Analytical', 'Conversation', 'Creative', 'Reading', 'Social Media', 'Watching'];
      return categories.map((task) => ({
        task,
        count: 0,
        total_seconds: 0,
        total_hours: 0,
      }));
    }

    // Aggregate seconds by task
    const byTask: Record<string, { count: number; total_seconds: number }> = {};
    const categories = ['Analytical', 'Conversation', 'Creative', 'Reading', 'Social Media', 'Watching'];
    
    for (const category of categories) {
      byTask[category] = { count: 0, total_seconds: 0 };
    }

    for (const r of rows) {
      const task = r.task as string;
      if (byTask[task]) {
        byTask[task].count += 1;
        byTask[task].total_seconds += r.seconds || 0;
      }
    }

    const aggregated = categories.map((task) => ({
      task,
      count: byTask[task].count,
      total_seconds: byTask[task].total_seconds,
      total_hours: byTask[task].total_seconds / 3600,
    }));

    console.log('[getLifetimeTaskStats] Aggregated lifetime stats:', aggregated);
    return aggregated;
  } catch (error) {
    console.error("Error fetching lifetime task stats:", error);
    return [];
  }
};

// Helper to broadcast email analysis progress to all renderer windows
const broadcastEmailAnalysisProgress = (progress: AnalysisProgress): void => {
  try {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((w) => {
      w.webContents.send('email-analysis-progress', progress);
    });
  } catch (error) {
    console.warn('Failed to broadcast email analysis progress:', error);
  }
};

// Analyze user emails with Composio and save to Supabase
export const analyzeUserEmails = async (services: string[]): Promise<EmailAnalysisResult> => {
  if (!userEmail) {
    return {
      success: false,
      error: 'User not logged in. Please sign in with Google first.',
    };
  }

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not initialized. Cannot save analysis results.',
    };
  }

  // Check if Gmail is in the selected services
  if (!services.includes('gmail')) {
    return {
      success: false,
      error: 'Gmail not selected for analysis',
    };
  }

  try {
    console.log('[EmailAnalysis] Starting email analysis for user:', userEmail);

    // Generate a unique user ID for Composio using dynamic import (nanoid is ES Module)
    const { nanoid } = await import('nanoid');
    const composioUserId = `user_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${nanoid(8)}`;

    // Perform email analysis with progress updates
    const result = await performEmailAnalysis(composioUserId, (progress) => {
      broadcastEmailAnalysisProgress(progress);
    });

    if (!result.success || !result.analysis) {
      broadcastEmailAnalysisProgress({
        stage: 'error',
        message: result.error || 'Analysis failed',
        service: 'gmail',
      });
      return result;
    }

    // Save analysis to Supabase
    broadcastEmailAnalysisProgress({
      stage: 'saving',
      message: 'Saving analysis results...',
      service: 'gmail',
    });

    // Check if user exists in the database
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', userEmail)
      .maybeSingle();

    if (fetchError) {
      console.error('[EmailAnalysis] Error checking for existing user:', fetchError);
    }

    // Prepare Gmail analysis data
    const gmailData = {
      connectedAccountId: result.connectedAccountId,
      analysis: result.analysis,
      analyzedAt: new Date().toISOString(),
    };

    if (existingUser) {
      // Update existing user
      const { error: updateError } = await supabase
        .from('users')
        .update({ gmail: gmailData })
        .eq('email', userEmail);

      if (updateError) {
        console.error('[EmailAnalysis] Error updating user:', updateError);
        broadcastEmailAnalysisProgress({
          stage: 'error',
          message: 'Failed to save analysis',
          service: 'gmail',
        });
        return {
          success: false,
          error: `Failed to save analysis: ${updateError.message}`,
        };
      }
    } else {
      // Insert new user
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          email: userEmail,
          gmail: gmailData,
        });

      if (insertError) {
        console.error('[EmailAnalysis] Error inserting user:', insertError);
        broadcastEmailAnalysisProgress({
          stage: 'error',
          message: 'Failed to save analysis',
          service: 'gmail',
        });
        return {
          success: false,
          error: `Failed to save analysis: ${insertError.message}`,
        };
      }
    }

    console.log('[EmailAnalysis] Analysis saved successfully');
    
    // Broadcast completion
    broadcastEmailAnalysisProgress({
      stage: 'complete',
      message: 'Analysis complete!',
      service: 'gmail',
    });

    return result;
  } catch (error) {
    console.error('[EmailAnalysis] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error';
    
    broadcastEmailAnalysisProgress({
      stage: 'error',
      message: errorMessage,
      service: 'gmail',
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
};

// Upload conversation to Supabase
export const uploadConversation = async (conversationData: ConversationData): Promise<ConversationUploadResult> => {
  if (!userEmail) {
    return {
      success: false,
      error: 'User not logged in. Please sign in with Google first.',
    };
  }

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not initialized. Cannot save conversation.',
    };
  }

  if (!genAI) {
    return {
      success: false,
      error: 'Gemini AI not initialized. Cannot summarize conversation.',
    };
  }

  try {
    console.log('[uploadConversation] Starting conversation upload and summarization for user:', userEmail);

    // Generate summary with Gemini AI
    const conversationText = conversationData.messages
      .map(msg => `${msg.role}: ${msg.message}`)
      .join('\n\n');

    const prompt = `Analyze this voice conversation between a user and an AI coach. Provide a comprehensive summary in JSON format with the following structure:
{
  "summary": "Brief overall summary of the conversation",
  "topics_discussed": ["topic1", "topic2", "topic3"],
  "key_insights": ["insight1", "insight2", "insight3"],
  "user_concerns": ["concern1", "concern2"],
  "action_items": ["action1", "action2"],
  "sentiment": "positive/neutral/negative",
  "conversation_quality": "high/medium/low"
}

Conversation:
${conversationText}

Return ONLY valid JSON, no other text.`;

    console.log('[uploadConversation] Generating summary with Gemini...');
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [prompt],
    });

    const responseText = result.text || '';
    console.log('[uploadConversation] Gemini response:', responseText);

    // Parse JSON from response
    let summary: any;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summary = JSON.parse(jsonMatch[0]);
      } else {
        summary = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error('[uploadConversation] Failed to parse JSON:', parseError);
      summary = {
        summary: responseText || 'No summary available',
        topics_discussed: [],
        key_insights: [],
        user_concerns: [],
        action_items: [],
        sentiment: "neutral",
        conversation_quality: "medium"
      };
    }

    // Prepare conversation data with summary
    const conversationToSave = {
      messages: conversationData.messages,
      sessionStartAt: conversationData.sessionStartAt,
      sessionEndAt: conversationData.sessionEndAt,
      summary: summary,
      analyzedAt: new Date().toISOString(),
    };

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, email, conversation')
      .eq('email', userEmail)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[uploadConversation] Error checking for existing user:', fetchError);
    }

    // Append to existing conversations or create new array
    let conversations: any[] = [];
    if (existingUser?.conversation) {
      // Handle both array and single object formats
      if (Array.isArray(existingUser.conversation)) {
        conversations = existingUser.conversation as any[];
      } else {
        conversations = [existingUser.conversation as any];
      }
    }
    conversations.push(conversationToSave);

    if (existingUser) {
      // Update existing user
      const { error: updateError } = await supabase
        .from('users')
        .update({ conversation: conversations })
        .eq('email', userEmail);

      if (updateError) {
        console.error('[uploadConversation] Error updating user:', updateError);
        return {
          success: false,
          error: `Failed to save conversation: ${updateError.message}`,
        };
      }
    } else {
      // Insert new user
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          email: userEmail,
          conversation: conversations,
        });

      if (insertError) {
        console.error('[uploadConversation] Error inserting user:', insertError);
        return {
          success: false,
          error: `Failed to save conversation: ${insertError.message}`,
        };
      }
    }

    console.log('[uploadConversation] Conversation saved successfully');
    
    // After conversation is uploaded, generate system prompt
    try {
      console.log('[uploadConversation] Triggering system prompt generation...');
      const systemPromptResult = await generateSystemPrompt();
      if (systemPromptResult.success) {
        console.log('[uploadConversation] System prompt generated successfully');
      } else {
        console.error('[uploadConversation] Failed to generate system prompt:', systemPromptResult.error);
      }
    } catch (systemPromptError) {
      // Don't fail conversation upload if system prompt generation fails
      console.error('[uploadConversation] Error generating system prompt:', systemPromptError);
    }
    
    return { success: true };
  } catch (error) {
    console.error('[uploadConversation] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error';
    return {
      success: false,
      error: errorMessage,
    };
  }
};

// Upload research summary to Supabase
export const uploadResearchSummary = async (research: ResearchResponse): Promise<ResearchUploadResult> => {
  if (!userEmail) {
    return {
      success: false,
      error: 'User not logged in. Please sign in with Google first.',
    };
  }

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not initialized. Cannot save research.',
    };
  }

  if (!genAI) {
    return {
      success: false,
      error: 'Gemini AI not initialized. Cannot summarize research.',
    };
  }

  try {
    console.log('[uploadResearchSummary] Starting research upload and summarization for user:', userEmail);

    // Generate summary with Gemini AI
    const researchContent = research.output?.content || '';
    const instructions = research.instructions || '';

    const prompt = `Analyze this research output and provide a structured summary in JSON format:
{
  "overview": "Brief 2-3 sentence overview of the research",
  "keyFindings": ["finding1", "finding2", "finding3"],
  "insights": ["insight1", "insight2", "insight3"],
  "searchesPerformed": ${research.costDollars?.numSearches || 0},
  "pagesAnalyzed": ${research.costDollars?.numPages || 0},
  "timestamp": "${new Date().toISOString()}"
}

Research Question: ${instructions}

Research Output:
${researchContent.substring(0, 10000)}

Return ONLY valid JSON, no other text.`;

    console.log('[uploadResearchSummary] Generating summary with Gemini...');
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [prompt],
    });

    const responseText = result.text || '';
    console.log('[uploadResearchSummary] Gemini response:', responseText);

    // Parse JSON from response
    let summary: ResearchSummary;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summary = JSON.parse(jsonMatch[0]);
      } else {
        summary = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error('[uploadResearchSummary] Failed to parse JSON:', parseError);
      summary = {
        overview: researchContent.substring(0, 500) || 'No overview available',
        keyFindings: [],
        insights: [],
        searchesPerformed: research.costDollars?.numSearches || 0,
        pagesAnalyzed: research.costDollars?.numPages || 0,
        timestamp: new Date().toISOString(),
      };
    }

    // Prepare research data with summary
    const researchToSave = {
      researchId: research.researchId,
      instructions: research.instructions,
      summary: summary,
      fullOutput: researchContent,
      costDollars: research.costDollars,
      createdAt: new Date(research.createdAt).toISOString(),
      analyzedAt: new Date().toISOString(),
    };

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, email, research')
      .eq('email', userEmail)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[uploadResearchSummary] Error checking for existing user:', fetchError);
    }

    // Append to existing research or create new array
    let researches: any[] = [];
    if (existingUser?.research) {
      // Handle both array and single object formats
      if (Array.isArray(existingUser.research)) {
        researches = existingUser.research as any[];
      } else {
        researches = [existingUser.research as any];
      }
    }
    researches.push(researchToSave);

    if (existingUser) {
      // Update existing user
      const { error: updateError } = await supabase
        .from('users')
        .update({ research: researches })
        .eq('email', userEmail);

      if (updateError) {
        console.error('[uploadResearchSummary] Error updating user:', updateError);
        return {
          success: false,
          error: `Failed to save research: ${updateError.message}`,
        };
      }
    } else {
      // Insert new user
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          email: userEmail,
          research: researches,
        });

      if (insertError) {
        console.error('[uploadResearchSummary] Error inserting user:', insertError);
        return {
          success: false,
          error: `Failed to save research: ${insertError.message}`,
        };
      }
    }

    console.log('[uploadResearchSummary] Research saved successfully');
    return { success: true };
  } catch (error) {
    console.error('[uploadResearchSummary] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error';
    return {
      success: false,
      error: errorMessage,
    };
  }
};

// Generate system prompt based on user's conversation, research, and email data
export const generateSystemPrompt = async (): Promise<SystemPromptResult> => {
  if (!userEmail) {
    return {
      success: false,
      error: 'User not logged in. Please sign in with Google first.',
    };
  }

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not initialized. Cannot generate system prompt.',
    };
  }

  if (!genAI) {
    return {
      success: false,
      error: 'Gemini AI not initialized. Cannot generate system prompt.',
    };
  }

  try {
    console.log('[generateSystemPrompt] Fetching user data for:', userEmail);

    // Fetch all user data from Supabase
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('conversation, research, gmail')
      .eq('email', userEmail)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[generateSystemPrompt] Error fetching user data:', fetchError);
      return {
        success: false,
        error: `Failed to fetch user data: ${fetchError.message}`,
      };
    }

    if (!userData) {
      console.log('[generateSystemPrompt] No user data found');
      return {
        success: false,
        error: 'No user data found. Please complete conversations or research first.',
      };
    }

    // Build context from all available data
    let contextParts: string[] = [];

    // Add conversation context
    if (userData.conversation) {
      const conversations = Array.isArray(userData.conversation) 
        ? userData.conversation 
        : [userData.conversation];
      
      contextParts.push('=== CONVERSATION HISTORY ===');
      conversations.forEach((conv: any, idx: number) => {
        if (conv.summary) {
          contextParts.push(`\nConversation ${idx + 1}:`);
          contextParts.push(JSON.stringify(conv.summary, null, 2));
        }
      });
    }

    // Add research context
    if (userData.research) {
      const researches = Array.isArray(userData.research) 
        ? userData.research 
        : [userData.research];
      
      contextParts.push('\n=== RESEARCH HISTORY ===');
      researches.forEach((res: any, idx: number) => {
        contextParts.push(`\nResearch ${idx + 1}:`);
        contextParts.push(`Instructions: ${res.instructions || 'N/A'}`);
        if (res.summary) {
          contextParts.push(`Summary: ${JSON.stringify(res.summary, null, 2)}`);
        }
      });
    }

    // Add email analysis context
    if (userData.gmail?.analysis) {
      contextParts.push('\n=== EMAIL ANALYSIS ===');
      contextParts.push(JSON.stringify(userData.gmail.analysis, null, 2));
    }

    const fullContext = contextParts.join('\n');

    if (contextParts.length === 0) {
      return {
        success: false,
        error: 'No context data available. Please complete conversations, research, or email analysis first.',
      };
    }

    // Generate system prompt with Gemini
    const prompt = `You are analyzing comprehensive data about a user to understand their life goals and what tasks they need to accomplish to achieve those goals.

Based on the following data about the user, generate a system prompt that will be used to guide future AI interactions with this user.

${fullContext}

Please analyze all the above information and provide a detailed JSON response with the following structure:
{
  "lifeGoals": ["goal1", "goal2", "goal3"],
  "tasksToAccomplish": ["task1", "task2", "task3"],
  "overview": "A comprehensive 2-3 paragraph overview of the user's current situation, aspirations, and what they need to focus on",
  "keyThemes": ["theme1", "theme2", "theme3"]
}

Be specific and actionable in identifying:
1. The user's explicit and implicit life goals based on their conversations, research topics, and communication patterns
2. Concrete tasks and actions they need to take to move toward those goals
3. Key themes and patterns in their behavior and aspirations

Return ONLY valid JSON, no other text.`;

    console.log('[generateSystemPrompt] Generating system prompt with Gemini...');
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [prompt],
    });

    const responseText = result.text || '';
    console.log('[generateSystemPrompt] Gemini response:', responseText);

    // Parse JSON from response
    let systemPrompt: SystemPrompt;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        systemPrompt = {
          ...parsed,
          generatedAt: new Date().toISOString(),
        };
      } else {
        const parsed = JSON.parse(responseText);
        systemPrompt = {
          ...parsed,
          generatedAt: new Date().toISOString(),
        };
      }
    } catch (parseError) {
      console.error('[generateSystemPrompt] Failed to parse JSON:', parseError);
      systemPrompt = {
        lifeGoals: ['Unable to parse specific goals from available data'],
        tasksToAccomplish: ['Complete more conversations and research to generate specific tasks'],
        overview: responseText || 'Unable to generate overview from available data',
        keyThemes: [],
        generatedAt: new Date().toISOString(),
      };
    }

    // Save system prompt to Supabase
    const { error: updateError } = await supabase
      .from('users')
      .update({ system: systemPrompt })
      .eq('email', userEmail);

    if (updateError) {
      console.error('[generateSystemPrompt] Error updating user:', updateError);
      return {
        success: false,
        error: `Failed to save system prompt: ${updateError.message}`,
      };
    }

    console.log('[generateSystemPrompt] System prompt saved successfully');
    return { 
      success: true,
      systemPrompt: systemPrompt,
    };
  } catch (error) {
    console.error('[generateSystemPrompt] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error';
    return {
      success: false,
      error: errorMessage,
    };
  }
};
