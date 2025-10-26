import { useState, useEffect } from "react";
import { TrendingUp, Loader2 } from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="items-center pb-4">
          <CardTitle>Activity Radar Chart</CardTitle>
          <CardDescription>
            Your activity distribution across different categories
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-0">
          {hasData ? (
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square max-h-[400px]"
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
        </CardContent>
        <CardFooter className="flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 leading-none font-medium">
            {hasData ? `Total: ${totalMinutes.toFixed(1)} minutes tracked` : "Get started with activity tracking"}
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-muted-foreground flex items-center gap-2 leading-none">
            Based on your task categories from the stats table
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Dashboard;

