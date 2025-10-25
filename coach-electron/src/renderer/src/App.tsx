import { Button } from "@/components/ui/button";
import googleIcon from "./assets/google_icon.svg";

const App = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-0">
      <div className="text-center mb-32">
        <h1 className="text-3xl font-bold mb-2">Create an Account</h1>
        <p className="text-gray-600">Talk to future you</p>
      </div>
      <Button className="w-fit rounded-full bg-white border border-gray-300 text-black hover:bg-gray-100 flex items-center gap-2">
        <img src={googleIcon} alt="Google" className="w-4 h-4" />
        Continue with Google
      </Button>
      <Button className="w-40 rounded-full bg-white border-0 text-black text-xs hover:bg-white">Continue as Caden</Button>
    </div>
  );
};

export default App;
