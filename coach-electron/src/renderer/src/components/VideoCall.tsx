import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2Icon, VideoIcon, PhoneIcon, PhoneOffIcon, RefreshCwIcon } from "lucide-react";
import { cn } from "@/utils";

interface CaptureWindow {
  id: string;
  name: string;
  thumbnail?: string;
}

interface VideoCallStatus {
  isActive: boolean;
  sourceId?: string;
  windowName?: string;
}

type CallState = "idle" | "loading" | "ringing" | "active" | "error";

export default function VideoCall() {
  const [windows, setWindows] = useState<CaptureWindow[]>([]);
  const [selectedWindow, setSelectedWindow] = useState<string>("");
  const [callState, setCallState] = useState<CallState>("idle");
  const [error, setError] = useState<string>("");
  const [videoCallStatus, setVideoCallStatus] = useState<VideoCallStatus>({ isActive: false });

  // Load available windows
  const loadWindows = useCallback(async () => {
    try {
      setCallState("loading");
      setError("");
      
      const availableWindows = await window.context.listCaptureWindows();
      setWindows(availableWindows);
      
      // Try to find Pickle windows first
      const pickleWindows = await window.context.findPickleWindows();
      if (pickleWindows.length > 0) {
        setSelectedWindow(pickleWindows[0].id);
      } else if (availableWindows.length > 0) {
        setSelectedWindow(availableWindows[0].id);
      }
      
      setCallState("idle");
    } catch (err) {
      console.error("Failed to load windows:", err);
      setError("Failed to load available windows. Check screen recording permissions.");
      setCallState("error");
    }
  }, []);

  // Check video call status
  const checkVideoCallStatus = useCallback(async () => {
    try {
      const status = await window.context.getVideoCallStatus();
      setVideoCallStatus(status);
      
      if (status.isActive) {
        setCallState("active");
      } else {
        setCallState("idle");
      }
    } catch (err) {
      console.error("Failed to get video call status:", err);
    }
  }, []);

  // Start video call
  const startVideoCall = useCallback(async () => {
    if (!selectedWindow) {
      setError("Please select a window to capture");
      return;
    }

    try {
      setCallState("loading");
      setError("");

      // Validate the window first
      const validation = await window.context.validateWindow(selectedWindow);
      if (!validation.valid) {
        setError(validation.reason || "Selected window is not suitable for capture");
        setCallState("error");
        return;
      }

      // Start the video call
      const result = await window.context.startVideoCall(selectedWindow);
      
      if (result.success) {
        setCallState("ringing");
        setVideoCallStatus({
          isActive: true,
          sourceId: result.sourceId,
          windowName: result.windowName,
        });
      } else {
        setError(result.message || "Failed to start video call");
        setCallState("error");
      }
    } catch (err) {
      console.error("Failed to start video call:", err);
      setError("Failed to start video call. Please try again.");
      setCallState("error");
    }
  }, [selectedWindow]);

  // End video call
  const endVideoCall = useCallback(async () => {
    try {
      await window.context.endVideoCall();
      setCallState("idle");
      setVideoCallStatus({ isActive: false });
    } catch (err) {
      console.error("Failed to end video call:", err);
    }
  }, []);

  // Load windows on component mount
  useEffect(() => {
    loadWindows();
    checkVideoCallStatus();
  }, [loadWindows, checkVideoCallStatus]);

  // Poll for video call status changes
  useEffect(() => {
    const interval = setInterval(checkVideoCallStatus, 1000);
    return () => clearInterval(interval);
  }, [checkVideoCallStatus]);

  const isCallActive = callState === "active" || callState === "ringing";
  const isLoading = callState === "loading";

  return (
    <Card className="flex h-[400px] w-full flex-col items-center justify-center overflow-hidden p-6">
      <div className="flex flex-col items-center gap-6 w-full">
        <div className="flex items-center gap-2">
          <VideoIcon className="h-6 w-6" />
          <h2 className="text-xl font-semibold">Video Call</h2>
        </div>

        {error && (
          <div className="text-destructive text-sm text-center bg-destructive/10 p-3 rounded-md w-full">
            {error}
          </div>
        )}

        {callState === "idle" && (
          <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Select Window to Capture:</label>
              <select
                value={selectedWindow}
                onChange={(e) => setSelectedWindow(e.target.value)}
                className="w-full p-2 border rounded-md bg-background"
                disabled={isLoading}
              >
                <option value="">Choose a window...</option>
                {windows.map((window) => (
                  <option key={window.id} value={window.id}>
                    {window.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 w-full">
              <Button
                onClick={loadWindows}
                variant="outline"
                size="sm"
                disabled={isLoading}
                className="flex-1"
              >
                <RefreshCwIcon className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={startVideoCall}
                disabled={!selectedWindow || isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <PhoneIcon className="h-4 w-4 mr-2" />
                    Start Call
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {callState === "ringing" && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-center">
              <p className="text-lg font-medium">Calling...</p>
              <p className="text-sm text-muted-foreground">
                {videoCallStatus.windowName}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={endVideoCall}
                variant="destructive"
                size="sm"
              >
                <PhoneOffIcon className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {callState === "active" && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-center">
              <p className="text-lg font-medium text-green-600">Call Active</p>
              <p className="text-sm text-muted-foreground">
                Connected to {videoCallStatus.windowName}
              </p>
            </div>
            <Button
              onClick={endVideoCall}
              variant="destructive"
              size="sm"
            >
              <PhoneOffIcon className="h-4 w-4 mr-2" />
              End Call
            </Button>
          </div>
        )}

        {callState === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-center">
              <p className="text-lg font-medium text-destructive">Call Failed</p>
              <p className="text-sm text-muted-foreground">
                {error}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={loadWindows}
                variant="outline"
                size="sm"
              >
                <RefreshCwIcon className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Button
                onClick={() => setCallState("idle")}
                size="sm"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {windows.length === 0 && callState === "idle" && (
          <div className="text-center text-muted-foreground">
            <p>No windows available for capture.</p>
            <p className="text-sm">Make sure you have screen recording permissions enabled.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
