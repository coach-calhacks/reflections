import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

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
    <div className="flex min-h-screen p-4">
      {/* Left Side - Radar Chart */}
      <div className="flex flex-col w-1/2 items-center justify-center">
        {hasData ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-square max-h-[400px] w-full max-w-md"
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
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            No activity data available yet. Start tracking to see your stats!
          </div>
        )}
      </div>
      
      {/* Right Side - Blank */}
      <div className="flex flex-col w-1/2">
      </div>
    </div>
  );
};

export default Dashboard;

