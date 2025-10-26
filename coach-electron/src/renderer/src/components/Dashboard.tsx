import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, PolarRadiusAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ScreenCaptureStatus } from "@shared/types";
import DashboardChat from "./DashboardChat";

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
  const [isLifetimeView, setIsLifetimeView] = useState(false);
  
  // Recording state
  const [captureStatus, setCaptureStatus] = useState<ScreenCaptureStatus>({
    isCapturing: false,
    interval: 18,
    saveFolder: "",
  });
  const [intervalInput, setIntervalInput] = useState<string>("18");
  const [statusMessage, setStatusMessage] = useState<string>("");

  const fetchStats = async () => {
      try {
        setIsLoading(true);
        // Fetch either lifetime or session stats based on toggle
        const stats = isLifetimeView 
          ? await window.context.getLifetimeTaskStats()
          : await window.context.getTaskStats();
        console.log("[Dashboard] fetchStats called, received stats:", JSON.stringify(stats, null, 2));
        
        // Transform the data for the chart
        // Convert seconds to minutes for better visibility
        const transformedData = stats.map((stat: any) => ({
          category: stat.task,
          value: Math.round((stat.total_seconds / 60) * 100) / 100, // Convert to minutes with 2 decimals
        }));
        console.log("[Dashboard] Transformed data:", JSON.stringify(transformedData, null, 2));
        
        // Custom order: Conversation first, then swap Reading and Social Media
        const customOrder = ['Conversation', 'Analytical', 'Creative', 'Social Media', 'Reading', 'Watching'];
        const reorderedData = customOrder.map(category => 
          transformedData.find((item: any) => item.category === category) || { category, value: 0 }
        );
        console.log("[Dashboard] Reordered data (for chart):", JSON.stringify(reorderedData, null, 2));
        setChartData(reorderedData);
        setError(null);
      } catch (err) {
        console.error("Error fetching task stats:", err);
        setError("Failed to load task statistics");
      } finally {
        setIsLoading(false);
      }
  };

  useEffect(() => {
    fetchStats();
    // Listen for stats updates from main process after new captures are analyzed
    console.log("[Dashboard] Setting up stats-updated listener");
    const unsubscribe = window.context.onStatsUpdated(() => {
      console.log("[Dashboard] stats-updated event received! Refetching stats...");
      fetchStats();
    });
    // Fallback: periodic refresh every 60s in case events are missed
    const interval = setInterval(fetchStats, 60000);
    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
    };
  }, [isLifetimeView]); // Add isLifetimeView to dependency array

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

  // Calculate dynamic axis max for radar chart based on total minutes recorded
  // This makes the scale responsive to the total duration of data
  // For example, if only 5 seconds of data exists, the chart will scale to show that as full scale
  const axisMax = totalMinutes > 0 ? totalMinutes * 1.2 : 1; // Add 20% padding for visual breathing room

  return (
    <div className="flex min-h-screen p-4 gap-4">
      {/* Left Side - Radar Chart and Screen Capture Controls */}
      <div className="flex flex-col w-1/2 items-center justify-center gap-6">
        {/* Chart Mode Toggle */}
        <div className="flex items-center gap-2 bg-white rounded-lg border p-3">
          <span className="text-sm font-medium">View:</span>
          <button
            onClick={() => setIsLifetimeView(false)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              !isLifetimeView 
                ? 'bg-orange-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Session
          </button>
          <button
            onClick={() => setIsLifetimeView(true)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              isLifetimeView 
                ? 'bg-orange-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Lifetime
          </button>
        </div>

        {/* Radar Chart */}
        <div className="w-full max-w-md flex items-center justify-center">
          {hasData ? (
            <div className="w-96 h-96">
              <ChartContainer
                config={chartConfig}
                className="w-full h-full"
              >
                <RadarChart
                  data={chartData}
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <PolarAngleAxis dataKey="category" />
                  <PolarRadiusAxis domain={[0, axisMax]} tick={false} axisLine={false} />
                  <PolarGrid gridType="polygon" />
                  <Radar
                    dataKey="value"
                    fill="var(--color-value)"
                    fillOpacity={0.6}
                    stroke="var(--color-value)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </RadarChart>
              </ChartContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground text-center px-4">
              No activity data available yet. Start tracking to see your stats!
            </div>
          )}
        </div>

        {/* Screen Capture Controls */}
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between gap-4 p-4 bg-white rounded-lg border">
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
      
      {/* Right Side - Chat */}
      <div className="flex flex-col w-1/2 items-center justify-center px-4">
        <div className="w-full max-w-2xl">
          <DashboardChat />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

