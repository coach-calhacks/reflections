# Google OAuth Setup Guide

This guide will help you set up Google OAuth for your Electron application.

## Prerequisites

You need a Google Cloud Platform account to create OAuth credentials.

## Step 1: Create Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Desktop app" as the application type
   - Give it a name (e.g., "Coach Electron App")
   - Click "Create"

5. Download the credentials:
   - You'll see a modal with your Client ID and Client Secret
   - **Important**: Save these credentials securely!

## Step 2: Configure Environment Variables

### Option 1: Using .env file (Recommended)

1. Create a `.env` file in the `coach-electron` directory (it's already in .gitignore):

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost
```

2. Replace `your-client-id-here` and `your-client-secret-here` with your actual credentials

3. Install dotenv package to load environment variables:

```bash
pnpm add dotenv
```

4. Update `electron.vite.config.ts` to load environment variables:

```typescript
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['electron']
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src/main'),
        '@shared': resolve(__dirname, './src/shared')
      }
    },
    define: {
      'process.env.GOOGLE_CLIENT_ID': JSON.stringify(process.env.GOOGLE_CLIENT_ID),
      'process.env.GOOGLE_CLIENT_SECRET': JSON.stringify(process.env.GOOGLE_CLIENT_SECRET),
      'process.env.GOOGLE_REDIRECT_URI': JSON.stringify(process.env.GOOGLE_REDIRECT_URI)
    }
  },
  // ... rest of config
})
```

### Option 2: Using System Environment Variables

Set the environment variables in your shell:

**macOS/Linux:**
```bash
export GOOGLE_CLIENT_ID="your-client-id-here.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret-here"
export GOOGLE_REDIRECT_URI="http://localhost"
```

**Windows (Command Prompt):**
```cmd
set GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
set GOOGLE_CLIENT_SECRET=your-client-secret-here
set GOOGLE_REDIRECT_URI=http://localhost
```

**Windows (PowerShell):**
```powershell
$env:GOOGLE_CLIENT_ID="your-client-id-here.apps.googleusercontent.com"
$env:GOOGLE_CLIENT_SECRET="your-client-secret-here"
$env:GOOGLE_REDIRECT_URI="http://localhost"
```

## Step 3: Configure Authorized Redirect URIs

1. Go back to the [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" > "Credentials"
3. Click on your OAuth 2.0 Client ID
4. Under "Authorized redirect URIs", add:
   - `http://localhost`
   - `http://127.0.0.1`
5. Click "Save"

## Step 4: Test the OAuth Flow

1. Start your Electron app:
```bash
pnpm dev
```

2. Click the "Continue with Google" button
3. A new window should open with Google's sign-in page
4. Sign in with your Google account
5. Grant the requested permissions
6. You should be redirected back to the app with your user information

## Troubleshooting

### "Google OAuth credentials not configured" error
- Make sure you've set the environment variables correctly
- Restart your development server after setting environment variables
- Check that your `.env` file is in the correct directory

### OAuth window doesn't open
- Check the console for errors
- Make sure your Client ID and Secret are correct
- Verify that the redirect URI matches what's configured in Google Cloud Console

### "redirect_uri_mismatch" error
- Make sure you've added `http://localhost` to the Authorized redirect URIs in Google Cloud Console
- The redirect URI in your environment variables should match exactly

### Permission denied errors
- Make sure you've enabled the Google+ API in your Google Cloud project
- Check that your OAuth consent screen is configured correctly

## Security Notes

- **Never commit your `.env` file or credentials to version control**
- The `.env` file is already in `.gitignore`
- Keep your Client Secret secure and don't share it
- For production builds, consider using a more secure method to store credentials

## Additional Scopes

The default implementation requests these scopes:
- `openid` - Basic OpenID Connect
- `profile` - User's basic profile information
- `email` - User's email address

To request additional scopes, modify the `buildAuthUrl` method in `src/main/lib/googleAuth.ts`:

```typescript
const params = new URLSearchParams({
  client_id: this.config.clientId,
  redirect_uri: this.config.redirectUri,
  response_type: "code",
  scope: "openid profile email https://www.googleapis.com/auth/calendar", // Add more scopes here
  access_type: "offline",
  prompt: "consent",
});
```

Available Google API scopes: https://developers.google.com/identity/protocols/oauth2/scopes

