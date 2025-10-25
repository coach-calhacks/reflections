import { Button } from "@/components/ui/button";
import googleIcon from "./assets/google_icon.svg";
import { useState } from "react";

const App = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);

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

  if (userInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Welcome, {userInfo.name}!</h1>
          <p className="text-gray-600">{userInfo.email}</p>
          {userInfo.picture && (
            <img 
              src={userInfo.picture} 
              alt="Profile" 
              className="w-20 h-20 rounded-full mx-auto mt-4"
            />
          )}
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
      <Button className="w-40 rounded-full bg-white border-0 text-black text-xs hover:bg-white mt-2">Continue as Caden</Button>
    </div>
  );
};

export default App;
