import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ScreenCaptureStatus } from "@shared/types";
import DashboardChat from "./DashboardChat";
import VideoCall from "./VideoCall";

const chartConfig = {
  value: {
    label: "Minutes",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const Dashboard = () => {
  const [chartData, setChartData] = useState<Array<{ category: string; value: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Recording state
  const [captureStatus, setCaptureStatus] = useState<ScreenCaptureStatus>({
    isCapturing: false,
    interval: 18,
    saveFolder: "",
  });
  const [intervalInput, setIntervalInput] = useState<string>("18");
  const [statusMessage, setStatusMessage] = useState<string>("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const stats = await window.context.getTaskStats();
        
        console.log("Received stats:", stats); // Debug log
        
        // Transform the data for the chart
        // Convert seconds to minutes for better visibility
        const transformedData = stats.map((stat: any) => ({
          category: stat.task,
          value: Math.round((stat.total_seconds / 60) * 100) / 100, // Convert to minutes with 2 decimals
        }));
        
        // Custom order: Conversation first, then swap Reading and Social Media
        const customOrder = ['Conversation', 'Analytical', 'Creative', 'Social Media', 'Reading', 'Watching'];
        const reorderedData = customOrder.map(category => 
          transformedData.find((item: any) => item.category === category) || { category, value: 0 }
        );
        
        console.log("Reordered data:", reorderedData); // Debug log
        
        setChartData(reorderedData);
        setError(null);
      } catch (err) {
        console.error("Error fetching task stats:", err);
        setError("Failed to load task statistics");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Load recording status
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

  // Recording handlers
  const handleToggleCapture = async () => {
    try {
      if (captureStatus.isCapturing) {
        // Stop capture
        await window.context.stopScreenCapture();
        setStatusMessage("Screen capture stopped");
        setCaptureStatus((prev) => ({ ...prev, isCapturing: false }));
      } else {
        // Start capture
        const interval = parseInt(intervalInput) || 18;
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading your activity data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  const totalMinutes = chartData.reduce((sum, item) => sum + item.value, 0);
  const hasData = totalMinutes > 0;

  return (
    <div className="flex min-h-screen p-4 gap-4">
      {/* Left Side - Radar Chart and Screen Capture Controls */}
      <div className="flex flex-col w-1/3 items-center justify-center gap-6">
        {/* Radar Chart */}
        <div className="w-full max-w-md">
          {hasData ? (
            <ChartContainer
              config={chartConfig}
              className="aspect-square max-h-[400px] w-full"
            >
              <RadarChart data={chartData}>
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <PolarAngleAxis dataKey="category" />
                <PolarGrid gridType="polygon" />
                <Radar
                  dataKey="value"
                  fill="var(--color-value)"
                  fillOpacity={0.6}
                  stroke="var(--color-value)"
                  strokeWidth={2}
                />
              </RadarChart>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground text-center px-4">
              No activity data available yet. Start tracking to see your stats!
            </div>
          )}
        </div>

        {/* Screen Capture Controls */}
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-4 p-4 bg-white rounded-lg border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <span className={`text-sm font-bold ${captureStatus.isCapturing ? 'text-green-600' : 'text-gray-500'}`}>
                {captureStatus.isCapturing ? '● Capturing' : '○ Stopped'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Interval:</label>
              <input
                type="number"
                min="1"
                value={intervalInput}
                onChange={(e) => handleIntervalChange(e.target.value)}
                className="w-16 px-2 py-1 border rounded text-sm"
                disabled={captureStatus.isCapturing}
              />
              <span className="text-xs text-muted-foreground">sec</span>
            </div>

            <Button
              onClick={handleToggleCapture}
              variant={captureStatus.isCapturing ? "destructive" : "default"}
              size="sm"
            >
              {captureStatus.isCapturing ? 'Stop Capture' : 'Start Capture'}
            </Button>
          </div>

          {statusMessage && (
            <div className="mt-4 text-xs text-muted-foreground bg-background/50 rounded p-2 break-words text-center">
              {statusMessage}
            </div>
          )}
        </div>
      </div>
      
      {/* Middle - Video Call */}
      <div className="flex flex-col w-1/3 items-center justify-center px-4">
        <div className="w-full max-w-2xl">
          <VideoCall />
        </div>
      </div>
      
      {/* Right Side - Chat */}
      <div className="flex flex-col w-1/3 items-center justify-center px-4">
        <div className="w-full max-w-2xl">
          <DashboardChat />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

