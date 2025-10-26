import { useState, Component, ReactNode, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import googleIcon from "./assets/google_icon.svg";
import VoiceChat from "@/components/VoiceChat";
import { ResearchDemo } from "@/components/ResearchDemo";
import { GLBViewer } from "@/components/GLBViewer";
import { MCPLoadingScreen } from "@/components/MCPLoadingScreen";
import Dashboard from "@/components/Dashboard";

type SetupStep = "mcp" | "research" | "voice" | "complete";

// Error boundary to catch 3D viewer errors
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("3D Viewer Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-gray-50">
          <p className="text-gray-400">3D viewer unavailable</p>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<"login" | "dashboard" | "research">("login");
  const [setupStep, setSetupStep] = useState<SetupStep>("mcp");

  // Dev mode: skip to dashboard with 'S' key
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') {
        console.log('[Dev Mode] Skipping research, jumping to dashboard...');
        setSetupStep("complete");
        setCurrentPage("dashboard");
        // Set a mock user if not already set
        if (!userInfo) {
          setUserInfo({
            name: "Dev User",
            email: "dev@example.com",
            id: "dev-user-id"
          });
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [userInfo]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await window.context.signInWithGoogle();
      
      if (result.success && result.userInfo) {
        console.log("Successfully signed in:", result.userInfo);
        setUserInfo(result.userInfo);
        // You can store the tokens in localStorage or state management
        // localStorage.setItem('accessToken', result.accessToken || '');
        // localStorage.setItem('refreshToken', result.refreshToken || '');
      } else {
        setError(result.error || "Failed to sign in with Google");
        console.error("Sign in failed:", result.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Sign in error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getProgressValue = () => {
    switch (setupStep) {
      case "mcp":
        return 25;
      case "research":
        return 50;
      case "voice":
        return 75;
      case "complete":
        return 100;
      default:
        return 0;
    }
  };


  // If on dashboard page, show the combined recording dashboard
  if (currentPage === "dashboard") {
    return <Dashboard />;
  }

  // If on research page, show the research demo
  if (currentPage === "research") {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4">
          <Button
            onClick={() => setCurrentPage("login")}
            variant="outline"
            className="mb-4"
          >
            ← Back
          </Button>
        </div>
        <ResearchDemo />
      </div>
    );
  }

  if (userInfo) {
    // Show setup progress before showing voice chat
    if (setupStep !== "complete") {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen relative width-full">
          {/* Progress bar at top */}
          <div className="absolute top-0 p-4">
            <Progress value={getProgressValue()} className="h-2" />
            <h1 className="text-2xl font-bold text-center pt-4 whitespace-nowrap">
              Learning about you, {userInfo.name.split(' ')[0]}
            </h1>
          </div>

          {/* Content */}
          <div className="w-full max-w-md space-y-6 p-4">
            {/* Show MCP loading screen during mcp step */}
            {setupStep === "mcp" && (
              <MCPLoadingScreen
                onComplete={() => {
                  setSetupStep("research");
                }}
              />
            )}

            {/* Show research demo during research step */}
            {setupStep === "research" && (
              <div>
                <ResearchDemo
                  autoStart={true}
                  userInfo={userInfo}
                  showOnlyCurrentEvent={true}
                  onComplete={() => {
                    setSetupStep("voice");
                  }}
                />
              </div>
            )}

            {/* Show continue button for other steps */}
            {setupStep !== "research" && setupStep !== "mcp" && (
              <div className="space-y-2">
                <Button 
                  onClick={() => {
                    if (setupStep === "voice") setSetupStep("complete");
                  }}
                  className="w-full"
                >
                  Continue
                </Button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        <div className="absolute top-4 right-4">
          <Button
            onClick={() => setCurrentPage("dashboard")}
            variant="outline"
            size="sm"
          >
            Dashboard
          </Button>
        </div>
        
        <div className="w-full max-w-md">
          <VoiceChat 
            userInfo={userInfo} 
            onEnded={() => {
              // After onboarding call ends, go to dashboard automatically
              setCurrentPage("dashboard")
            }}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-screen w-full">
      {/* Left side - Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-0 border-r border-gray-200">
        <div className="text-center mb-32">
          <h1 className="text-3xl font-bold mb-2">Reflection</h1>
          <p className="text-gray-600">Talk to yourself, from the future</p>
        </div>
        <div className="flex flex-col gap-0 items-center">
          <Button
            className="w-fit rounded-full bg-white border border-gray-300 text-black hover:bg-gray-100 flex items-center gap-2"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            <img src={googleIcon} alt="Google" className="w-4 h-4" />
            {isLoading ? "Signing in..." : "Continue with Google"}
          </Button>
          {error && (
            <p className="text-red-500 text-sm max-w-md text-center">{error}</p>
          )}
          <Button
            onClick={() => setCurrentPage("dashboard")}
            className="w-fit rounded-full bg-white border-0 text-black text-xs hover:bg-white"
          >
            Continue as Caden
          </Button>
        </div>
      </div>
      
      {/* Right side - 3D Model */}
      <div className="flex-1 h-full bg-black">
        <ErrorBoundary>
          <GLBViewer modelPath="/models/mohulpcfull.glb" className="w-full h-full" />
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default App;
