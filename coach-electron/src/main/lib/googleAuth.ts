import { BrowserWindow } from "electron";
import { URL } from "url";

interface GoogleAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface GoogleAuthResult {
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

const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export class GoogleAuth {
  private config: GoogleAuthConfig;

  constructor(config: GoogleAuthConfig) {
    this.config = config;
  }

  async signIn(): Promise<GoogleAuthResult> {
    try {
      const authCode = await this.getAuthorizationCode();
      if (!authCode) {
        return { success: false, error: "Failed to get authorization code" };
      }

      const tokens = await this.exchangeCodeForTokens(authCode);
      if (!tokens.access_token) {
        return { success: false, error: "Failed to exchange code for tokens" };
      }

      const userInfo = await this.getUserInfo(tokens.access_token);

      return {
        success: true,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        expiresIn: tokens.expires_in,
        userInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  private async getAuthorizationCode(): Promise<string | null> {
    return new Promise((resolve) => {
      let hasResolved = false;
      
      const safeResolve = (code: string | null) => {
        if (!hasResolved) {
          hasResolved = true;
          resolve(code);
        }
      };

      const authWindow = new BrowserWindow({
        width: 500,
        height: 600,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      const authUrl = this.buildAuthUrl();
      authWindow.loadURL(authUrl);
      authWindow.show();

      // Handle navigation - this catches the redirect before it tries to load
      authWindow.webContents.on("will-navigate", (event, url) => {
        if (url.startsWith(this.config.redirectUri)) {
          event.preventDefault();
          this.handleCallback(url, authWindow, safeResolve);
        }
      });

      // Handle redirect
      authWindow.webContents.on("will-redirect", (event, url) => {
        if (url.startsWith(this.config.redirectUri)) {
          event.preventDefault();
          this.handleCallback(url, authWindow, safeResolve);
        }
      });

      // Handle navigation (for some OAuth flows)
      authWindow.webContents.on("did-navigate", (event, url) => {
        if (url.startsWith(this.config.redirectUri)) {
          this.handleCallback(url, authWindow, safeResolve);
        }
      });

      // Handle the case where the page fails to load (ERR_CONNECTION_REFUSED)
      authWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
        // Check if this is our redirect URL with the auth code
        if (validatedURL.startsWith(this.config.redirectUri)) {
          this.handleCallback(validatedURL, authWindow, safeResolve);
        }
      });

      // Handle window close
      authWindow.on("closed", () => {
        safeResolve(null);
      });
    });
  }

  private buildAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: "openid profile email",
      access_type: "offline",
      prompt: "consent",
    });

    return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
  }

  private handleCallback(
    url: string,
    authWindow: BrowserWindow,
    resolve: (code: string | null) => void
  ): void {
    const urlObj = new URL(url);

    // Check if this is our redirect URI
    if (urlObj.origin + urlObj.pathname === this.config.redirectUri) {
      const code = urlObj.searchParams.get("code");
      authWindow.close();
      resolve(code);
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<any> {
    const params = new URLSearchParams({
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      grant_type: "authorization_code",
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    return response.json();
  }

  private async getUserInfo(accessToken: string): Promise<any> {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    return response.json();
  }
}

// Singleton instance
let googleAuthInstance: GoogleAuth | null = null;

export function initializeGoogleAuth(config: GoogleAuthConfig): void {
  googleAuthInstance = new GoogleAuth(config);
}

export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  if (!googleAuthInstance) {
    // Use environment variables or default values
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    // Use a simple localhost redirect that we'll intercept on failed load
    const redirectUri = "http://localhost";

    if (!clientId || !clientSecret) {
      return {
        success: false,
        error: "Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
      };
    }

    initializeGoogleAuth({ clientId, clientSecret, redirectUri });
  }

  return googleAuthInstance!.signIn();
}

// New function to exchange an authorization code for tokens (can be called from renderer)
export async function exchangeAuthCode(code: string): Promise<GoogleAuthResult> {
  if (!googleAuthInstance) {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const redirectUri = "http://localhost";

    if (!clientId || !clientSecret) {
      return {
        success: false,
        error: "Google OAuth credentials not configured.",
      };
    }

    initializeGoogleAuth({ clientId, clientSecret, redirectUri });
  }

  try {
    const tokens = await googleAuthInstance!["exchangeCodeForTokens"](code);
    if (!tokens.access_token) {
      return { success: false, error: "Failed to exchange code for tokens" };
    }

    const userInfo = await googleAuthInstance!["getUserInfo"](tokens.access_token);

    return {
      success: true,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresIn: tokens.expires_in,
      userInfo,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

