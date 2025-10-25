import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import googleIcon from "./assets/google_icon.svg";
import RecordingSettings from "@/components/RecordingSettings";
import VoiceChat from "@/components/VoiceChat";

type SetupStep = "mcp" | "research" | "voice" | "complete";

const App = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<"login" | "recording">("login");
  const [setupStep, setSetupStep] = useState<SetupStep>("mcp");

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

  const getStepTitle = () => {
    switch (setupStep) {
      case "mcp":
        return "Connecting to MCP Server";
      case "research":
        return "Running Deep Research";
      case "voice":
        return "Setting up Voice Agent";
      case "complete":
        return "Setup Complete!";
      default:
        return "";
    }
  };

  const getStepDescription = () => {
    switch (setupStep) {
      case "mcp":
        return "Establishing connection to Model Context Protocol...";
      case "research":
        return "Analyzing your data and building knowledge base...";
      case "voice":
        return "Initializing voice recognition and response system...";
      case "complete":
        return "You're all set! Ready to start your session.";
      default:
        return "";
    }
  };

  // If on recording settings page, show that component
  if (currentPage === "recording") {
    return <RecordingSettings />;
  }

  if (userInfo) {
    // Show setup progress before showing voice chat
    if (setupStep !== "complete") {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">{getStepTitle()}</h1>
              <p className="text-gray-600 text-sm">{getStepDescription()}</p>
            </div>
            
            <div className="space-y-2">
              <Progress value={getProgressValue()} className="h-2" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Step {getProgressValue() / 25} of 4</span>
                <span>{getProgressValue()}%</span>
              </div>
            </div>

            <div className="space-y-2 mt-8">
              <Button 
                onClick={() => {
                  if (setupStep === "mcp") setSetupStep("research");
                  else if (setupStep === "research") setSetupStep("voice");
                  else if (setupStep === "voice") setSetupStep("complete");
                }}
                className="w-full"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        
        <div className="w-full max-w-md">
          <VoiceChat userInfo={userInfo} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-0">
      <div className="text-center mb-32">
        <h1 className="text-3xl font-bold mb-2">Create an Account</h1>
        <p className="text-gray-600">Talk to future you</p>
      </div>
      <Button 
        className="w-fit rounded-full bg-white border border-gray-300 text-black hover:bg-gray-100 flex items-center gap-2"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
      >
        <img src={googleIcon} alt="Google" className="w-4 h-4" />
        {isLoading ? "Signing in..." : "Continue with Google"}
      </Button>
      {error && (
        <p className="text-red-500 text-sm mt-4 max-w-md text-center">{error}</p>
      )}
      <Button 
        onClick={() => setCurrentPage("recording")}
        className="w-40 rounded-full bg-white border-0 text-black text-xs hover:bg-white mt-2"
      >
        Continue as Caden
      </Button>
    </div>
  );
};

export default App;
