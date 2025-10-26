import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { EmailAnalysisProgress } from "@shared/types";

// Import the service icons
import xIcon from "../../../../images/x.png";
import googleCalendarIcon from "../../../../images/gcal.png";
import gmailIcon from "../../../../images/gmail.svg";
import driveIcon from "../../../../images/drive.png";
import notionIcon from "../../../../images/notion.png";

interface MCPLoadingScreenProps {
  onComplete: () => void;
}

type MCPService = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export function MCPLoadingScreen({ onComplete }: MCPLoadingScreenProps) {
  const [isSelectionPhase, setIsSelectionPhase] = useState(true);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [currentProgress, setCurrentProgress] = useState<EmailAnalysisProgress | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allServices: MCPService[] = [
    { id: "gmail", name: "Gmail", icon: gmailIcon, color: "bg-red-500" },
    { id: "calendar", name: "Google Calendar", icon: googleCalendarIcon, color: "bg-blue-500" },
    { id: "drive", name: "Google Drive", icon: driveIcon, color: "bg-green-500" },
    { id: "notion", name: "Notion", icon: notionIcon, color: "bg-gray-800" },
    { id: "twitter", name: "Twitter", icon: xIcon, color: "bg-black" }
  ];

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  const handleConnect = async () => {
    if (selectedServices.size === 0) return;
    
    setIsSelectionPhase(false);
    setError(null);

    try {
      // Convert Set to Array
      const servicesArray = Array.from(selectedServices);
      
      // Start the email analysis
      const result = await window.context.analyzeUserEmails(servicesArray);
      
      if (!result.success) {
        setError(result.error || 'Analysis failed');
        setCurrentProgress({
          stage: 'error',
          message: result.error || 'Analysis failed',
          service: 'gmail',
        });
      } else {
        // Analysis completed successfully
        setIsComplete(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setCurrentProgress({
        stage: 'error',
        message: errorMessage,
        service: 'gmail',
      });
    }
  };

  // Listen for progress updates
  useEffect(() => {
    if (!isSelectionPhase) {
      const unsubscribe = window.context.onEmailAnalysisProgress((progress) => {
        console.log('[MCPLoadingScreen] Progress:', progress);
        setCurrentProgress(progress);
        
        if (progress.stage === 'complete') {
          setIsComplete(true);
        } else if (progress.stage === 'error') {
          setError(progress.message);
        }
      });

      return unsubscribe;
    }
    return undefined;
  }, [isSelectionPhase]);

  const selectedServicesList = allServices.filter(s => selectedServices.has(s.id));

  if (isSelectionPhase) {
    return (
      <div className="flex flex-col items-center justify-center bg-white p-6 pt-24">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-4">
            <p className="text-lg font-semibold text-slate-800 mb-2">
              Connect Your Digital Ecosystem
            </p>
          </div>

          {/* Service Selection */}
          <Card className="p-6 mb-6 bg-white shadow-lg">
            <div className="space-y-4">
              {allServices.map((service) => (
                <label
                  key={service.id}
                  htmlFor={service.id}
                  className={`flex items-center space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                    selectedServices.has(service.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Checkbox */}
                  <Checkbox
                    id={service.id}
                    checked={selectedServices.has(service.id)}
                    onCheckedChange={() => toggleService(service.id)}
                    className="rounded-sm data-[state=checked]:bg-blue-600"
                  />

                  {/* Service Icon */}
                  <div className="w-10 h-10 flex items-center justify-center">
                    <img
                      src={service.icon}
                      alt={service.name}
                      className="w-8 h-8 object-contain"
                    />
                  </div>

                  {/* Service Name */}
                  <span className="text-sm font-medium text-slate-700 flex-1">
                    {service.name}
                  </span>
                </label>
              ))}
            </div>
          </Card>

          {/* Connect Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleConnect}
              disabled={selectedServices.size === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Connect {selectedServices.size > 0 && `(${selectedServices.size})`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center bg-white p-6 pt-24">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-sm text-slate-600">
            {error ? 'Connection failed' : 'Analyzing your digital ecosystem...'}
          </p>
        </div>

        {/* Service Icons */}
        <div className="relative mb-8">
          <div className="flex items-center justify-center space-x-8">
            {selectedServicesList.map((service, index) => (
              <div key={index} className="flex flex-col items-center">
                <Card
                  className={`w-16 h-16 flex items-center justify-center p-2 transition-all duration-500 ${
                    currentProgress?.service === service.id
                      ? 'bg-white shadow-lg scale-110 border-2 border-blue-500'
                      : 'bg-white shadow-md scale-100'
                  }`}
                >
                  <img
                    src={service.icon}
                    alt={service.name}
                    className="w-12 h-12 object-contain"
                  />
                </Card>
              </div>
            ))}
          </div>
        </div>

        {/* Status Text */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center space-x-2 bg-white px-3 py-1.5 rounded-full shadow-sm border">
            {!error && (
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            )}
            <span className={`text-xs font-medium ${error ? 'text-red-600' : 'text-slate-700'}`}>
              {currentProgress?.message || 'Starting analysis...'}
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-center mb-6">
            <p className="text-sm text-red-600">{error}</p>
            <Button
              onClick={() => {
                setError(null);
                setIsSelectionPhase(true);
                setCurrentProgress(null);
                setIsComplete(false);
              }}
              variant="outline"
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Next Button */}
        {isComplete && !error && (
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
