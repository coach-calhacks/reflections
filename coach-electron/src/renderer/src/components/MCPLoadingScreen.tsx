import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Import the service icons
import xIcon from "../../../../images/x.png";
import googleCalendarIcon from "../../../../images/gcal.png";
import notionIcon from "../../../../images/notion.png";

interface MCPLoadingScreenProps {
  onComplete: () => void;
}

export function MCPLoadingScreen({ onComplete }: MCPLoadingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const steps = [
    { name: "X (Twitter)", icon: xIcon, color: "bg-black" },
    { name: "Google Calendar", icon: googleCalendarIcon, color: "bg-blue-500" },
    { name: "Notion", icon: notionIcon, color: "bg-gray-800" }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          clearInterval(interval);
          setIsComplete(true);
          return prev;
        }
        return prev + 1;
      });
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [steps.length]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Analyzing Configured Resources
          </h1>
          <p className="text-sm text-slate-600">
            Connecting your digital ecosystem...
          </p>
        </div>


        {/* Service Flow */}
        <div className="relative mb-8">
          <div className="flex items-center justify-center space-x-8">
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center">
                {/* Service Card */}
                <Card 
                  className={`w-16 h-16 flex items-center justify-center p-2 transition-all duration-500 ${
                    index === currentStep 
                      ? 'bg-white shadow-lg scale-110 border-2 border-blue-500' 
                      : index < currentStep
                      ? 'bg-white shadow-md scale-100'
                      : 'bg-slate-100 shadow-sm scale-100'
                  }`}
                >
                  <img 
                    src={step.icon} 
                    alt={step.name}
                    className="w-12 h-12 object-contain"
                  />
                </Card>

                {/* Arrow */}
                {index < steps.length - 1 && index === currentStep && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full flex justify-center">
                    <div className="w-6 h-0.5 bg-slate-400 transition-all duration-1000" />
                    <div className="w-0 h-0 border-l-3 border-l-slate-400 border-t-1.5 border-t-transparent border-b-1.5 border-b-transparent transition-all duration-1000" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Status Text */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center space-x-2 bg-white px-3 py-1.5 rounded-full shadow-sm border">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-slate-700">
              {currentStep < steps.length 
                ? `Connecting to ${steps[currentStep].name}...` 
                : 'All services connected successfully!'
              }
            </span>
          </div>
        </div>

        {/* Next Button */}
        {isComplete && (
          <div className="flex justify-end">
            <Button 
              onClick={onComplete}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 text-sm"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
