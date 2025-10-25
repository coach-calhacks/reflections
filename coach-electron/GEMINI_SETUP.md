# Gemini Screenshot Analysis Setup

## Overview
Your Electron app now automatically analyzes every captured screenshot using Google's Gemini AI and logs the results to the terminal.

## Setup Instructions

### 1. Get Your Gemini API Key
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the API key

### 2. Configure the API Key
1. Open `/Users/richard/Documents/coach-main/coach-electron/.env`
2. Replace `your_api_key_here` with your actual API key:
   ```
   GEMINI_API_KEY=YOUR_ACTUAL_API_KEY_HERE
   ```
3. Save the file

### 3. Run the Application
```bash
cd /Users/richard/Documents/coach-main/coach-electron
npm run dev
```

## How It Works

1. When you start screen capture, the app takes screenshots at your specified interval
2. Each screenshot is saved to `~/Pictures/CoachScreenshots/`
3. Immediately after saving, the screenshot is sent to Gemini AI with the prompt: "What is this screenshot about?"
4. Gemini's analysis is logged to the terminal in a formatted output

## Example Terminal Output

```
Screenshot saved: /Users/richard/Pictures/CoachScreenshots/screenshot_2024-10-24_23-45-30.png

🔍 Analyzing screenshot with Gemini AI...

================================================================================
📸 SCREENSHOT ANALYSIS
================================================================================
File: screenshot_2024-10-24_23-45-30.png
Time: 10/24/2024, 11:45:30 PM
--------------------------------------------------------------------------------
This screenshot shows a code editor with an Electron application being 
developed. The code appears to be implementing screen capture functionality 
with TypeScript...
================================================================================
```

## Features

- **Automatic Analysis**: Every screenshot is automatically analyzed
- **No Interruption**: Analysis happens asynchronously without blocking capture
- **Error Handling**: Gracefully handles missing API keys or API failures
- **Detailed Logging**: Clear, formatted output for easy reading

## Troubleshooting

### No Analysis Output?
- Check that `GEMINI_API_KEY` is set in `.env`
- Ensure the API key is valid (not `your_api_key_here`)
- Check terminal for any error messages

### API Errors?
- Verify your API key is active in Google AI Studio
- Check your API quota and usage limits
- Ensure you have internet connectivity

## Security Note

⚠️ The `.env` file is already in `.gitignore` to prevent accidentally committing your API key. Never share your API key publicly.

## What Was Installed

- `@google/genai` - Official Google Generative AI SDK
- `dotenv` - Environment variable management

## Files Modified

- `src/main/lib/index.ts` - Added Gemini integration and analysis function
- `package.json` - Added new dependencies
- `.env` - Created for API key storage (you need to add your key)
- `.env.example` - Template for other developers

