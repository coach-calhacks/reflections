import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Versions from "@/components/Versions";
import electronIcon from "./assets/electron_icon.svg";
import reactIcon from "./assets/react_icon.svg";
import shadcnIcon from "./assets/shadcn_icon.svg";
import type { ScreenCaptureStatus } from "@shared/types";

const App = () => {
  const [count, setCount] = useState<number>(0);
  const [captureStatus, setCaptureStatus] = useState<ScreenCaptureStatus>({
    isCapturing: false,
    interval: 10,
    saveFolder: "",
  });
  const [intervalInput, setIntervalInput] = useState<string>("10");
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Load initial capture status
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const status = await window.context.getScreenCaptureStatus();
        setCaptureStatus(status);
        setIntervalInput(status.interval.toString());
      } catch (error) {
        console.error("Failed to load capture status:", error);
      }
    };
    loadStatus();
  }, []);

  const handleIncreaseCount = () => {
    setCount((prevCount) => prevCount + 1);
  };

  const handleTriggerIPC = () => {
    console.log(
      "IPC is invoked in main process, please check your terminal."
    );
    window.context.triggerIPC();
  };

  const handleToggleCapture = async () => {
    try {
      if (captureStatus.isCapturing) {
        // Stop capture
        await window.context.stopScreenCapture();
        setStatusMessage("Screen capture stopped");
        setCaptureStatus((prev) => ({ ...prev, isCapturing: false }));
      } else {
        // Start capture
        const interval = parseInt(intervalInput) || 10;
        const result = await window.context.startScreenCapture(interval);
        
        if (result.success) {
          setStatusMessage(result.message);
          setCaptureStatus((prev) => ({ 
            ...prev, 
            isCapturing: true,
            interval: interval 
          }));
        } else {
          setStatusMessage(`Error: ${result.message}`);
        }
      }
    } catch (error) {
      console.error("Failed to toggle capture:", error);
      setStatusMessage(`Error: ${error}`);
    }
  };

  const handleIntervalChange = async (value: string) => {
    setIntervalInput(value);
    const interval = parseInt(value);
    
    // Update interval if valid and currently capturing
    if (interval >= 1 && captureStatus.isCapturing) {
      try {
        await window.context.setScreenCaptureInterval(interval);
        setCaptureStatus((prev) => ({ ...prev, interval }));
        setStatusMessage(`Interval updated to ${interval} seconds`);
      } catch (error) {
        console.error("Failed to update interval:", error);
      }
    }
  };

  const handleOpenFolder = async () => {
    try {
      const folder = await window.context.getScreenCaptureFolder();
      setStatusMessage(`Screenshots saved to: ${folder}`);
    } catch (error) {
      console.error("Failed to get folder:", error);
    }
  };

  return (
    <div className="text-center">
      {/* logos */}
      <div className="flex justify-center items-center gap-6 my-8">
        <img
          className="w-32 opacity-80 animate-spin-slow"
          src={electronIcon}
        />
        <p className="text-3xl">+</p>
        <img
          className="w-32 h-28 opacity-80 animate-spin-slow"
          src={reactIcon}
        />
        <p className="text-3xl">+</p>
        <img
          className="w-32 h-24 opacity-80 animate-bounce-slow"
          src={shadcnIcon}
        />
      </div>
      {/* heading */}
      <h1 className="text-[2.1rem] mt-5 font-bold font-serif bg-gradient-to-r from-primary to-primary/40 text-secondary rounded-md">
        Electron + React + Shadcn
      </h1>
      <h3 className="my-5 font-bold text-lg">{count}</h3>
      {/* interaction buttons */}
      <div className="flex justify-center gap-5 mb-10">
        <Button onClick={handleIncreaseCount} className="w-32 h-9">
          Increase Count
        </Button>
        <Button onClick={handleTriggerIPC} className="w-32 h-9">
          Invoke IPC
        </Button>
      </div>

      {/* Screen Capture Section */}
      <div className="mt-8 mb-10 mx-auto max-w-md px-4">
        <h2 className="text-xl font-bold mb-4">Screen Capture</h2>
        
        <div className="bg-secondary/30 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="text-sm font-medium">Status:</span>
            <span className={`text-sm font-bold ${captureStatus.isCapturing ? 'text-green-600' : 'text-gray-500'}`}>
              {captureStatus.isCapturing ? '● Capturing' : '○ Stopped'}
            </span>
          </div>
          
          <div className="flex items-center justify-center gap-3 mb-3">
            <label className="text-sm font-medium">Interval (seconds):</label>
            <input
              type="number"
              min="1"
              value={intervalInput}
              onChange={(e) => handleIntervalChange(e.target.value)}
              className="w-20 px-2 py-1 border rounded text-sm"
              disabled={captureStatus.isCapturing}
            />
          </div>

          <div className="flex justify-center gap-3">
            <Button 
              onClick={handleToggleCapture}
              variant={captureStatus.isCapturing ? "destructive" : "default"}
              className="w-36"
            >
              {captureStatus.isCapturing ? 'Stop Capture' : 'Start Capture'}
            </Button>
            <Button 
              onClick={handleOpenFolder}
              variant="outline"
              className="w-36"
            >
              Show Folder
            </Button>
          </div>

          {statusMessage && (
            <div className="mt-3 text-xs text-muted-foreground bg-background/50 rounded p-2 break-words">
              {statusMessage}
            </div>
          )}
        </div>
      </div>

      {/* versions */}
      <Versions />
      <p className="text-sm mt-0">
        Press <span className="font-bold">F12</span> to toggle the
        DevTool. Press <span className="font-bold">Ctrl/Cmd+r</span>{" "}
        to re-draw the view.
      </p>
    </div>
  );
};

export default App;
