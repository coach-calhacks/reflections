# ElevenLabs Voice Chat Setup

## Overview
The Dashboard includes an integrated voice and text chat powered by ElevenLabs AI. This allows users to interact with an AI assistant through voice or text.

## Setup Instructions

### 1. Get Your ElevenLabs Agent ID
1. Visit [ElevenLabs](https://elevenlabs.io/)
2. Sign up or log in to your account
3. Navigate to the Conversational AI section
4. Create a new Agent or use an existing one
5. Copy your Agent ID from the agent settings

### 2. Configure the Agent ID

#### Option A: Create a .env file (Recommended)
1. In the project root (`coach-electron/`), create a new file named `.env`
2. Add your ElevenLabs Agent ID:
   ```
   ELEVENLABS_DEFAULT_AGENT_ID=your_actual_agent_id_here
   ```
3. Save the file

#### Option B: Copy from example
```bash
cp .env.example .env
```
Then edit the `.env` file and replace `your_elevenlabs_agent_id_here` with your actual Agent ID.

### 3. Run the Application
```bash
npm run dev
```

## How It Works

The chat interface appears on the right side of the Dashboard and provides:

1. **Text Chat**: Type messages to interact with the AI assistant
2. **Voice Chat**: Click the microphone icon to start a voice conversation
3. **Real-time Responses**: Get immediate AI responses via text or voice

## Features

- **Dual Mode**: Switch between text and voice conversations
- **Streaming Responses**: See responses as they're generated
- **Message History**: View past conversations in the current session
- **Copy Responses**: Copy AI responses to clipboard
- **Visual Feedback**: Animated orb shows connection status and voice activity

## Troubleshooting

### Chat Interface Not Visible?
- Ensure you've properly fixed the environment variable import (should use `import.meta.env.VITE_ELEVENLABS_DEFAULT_AGENT_ID`)
- Restart the development server after creating/updating the .env file
- Check the browser console for any errors

### "Tap to start voice chat" message but nothing happens?
- Verify your `ELEVENLABS_DEFAULT_AGENT_ID` is set in `.env`
- Ensure the Agent ID is valid and active in your ElevenLabs account
- Check your internet connectivity

### Voice chat not working?
- Grant microphone permissions when prompted by your browser/OS
- Check that your microphone is not being used by another application
- Verify microphone settings in your system preferences

### API Errors?
- Verify your Agent ID is active in ElevenLabs dashboard
- Check your API quota and usage limits
- Ensure you have a valid ElevenLabs subscription if required

## Security Note

⚠️ The `.env` file should be in `.gitignore` to prevent accidentally committing your API credentials. Never share your Agent ID publicly.

## What Was Installed

- `@elevenlabs/react` - Official ElevenLabs React SDK for conversational AI

## Files Modified

- `src/renderer/src/components/DashboardChat.tsx` - Fixed environment variable import
- `src/renderer/src/components/Dashboard.tsx` - Integrated chat into dashboard layout
- `src/renderer/src/env.d.ts` - Added TypeScript type definitions
- `electron.vite.config.ts` - Configured environment variable injection
- `.env.example` - Template for environment variables

## Chat Interface Layout

The Dashboard now features a split layout:
- **Left Side**: Activity radar chart and screen capture controls
- **Right Side**: ElevenLabs voice/text chat interface

This allows you to monitor your activity while getting AI assistance in real-time.

