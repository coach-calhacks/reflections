import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Loader2, CheckCircle2, XCircle, Brain, Search, FileText, ListChecks, Lightbulb, ChevronDown } from 'lucide-react';
import type {
  ResearchResponse,
  ResearchEvent,
} from '@shared/types';

interface ResearchDemoProps {
  autoStart?: boolean;
  userInfo?: {
    name: string;
    email: string;
  };
  onComplete?: () => void;
  showOnlyCurrentEvent?: boolean;
}

interface ProcessedEvent {
  event: ResearchEvent;
  isProcessing: boolean;
  timestamp: string;
}

export function ResearchDemo({ 
  autoStart = false, 
  userInfo,
  onComplete,
  showOnlyCurrentEvent = false 
}: ResearchDemoProps) {
  const [isResearching, setIsResearching] = useState(false);
  const [events, setEvents] = useState<ResearchEvent[]>([]);
  const [finalResult, setFinalResult] = useState<ResearchResponse | null>(null);
  const [instructions, setInstructions] = useState(
    userInfo 
      ? `Find out everything about ${userInfo.name} (${userInfo.email}). Research their entire background including: their early life and upbringing, where they went to school (elementary, high school, university), their location and where they've lived, their work history and career progression, what they currently do professionally, their achievements and notable projects, their interests and hobbies, their online presence and social media, and any other relevant information about who they are and what they've done throughout their life.`
      : 'What are the latest developments in AI research in 2025?'
  );
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const hasAutoStarted = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasCompletedRef = useRef(false);

  // Set up event listener on mount
  useEffect(() => {
    const unsubscribe = window.context.onResearchEvent((event: ResearchEvent) => {
      // Ignore any events that arrive after we've seen research-output
      if (hasCompletedRef.current && event.eventType !== 'research-output') {
        console.log('[ResearchDemo] Ignoring post-completion event:', event);
        return;
      }

      if (event.eventType === 'research-output') {
        hasCompletedRef.current = true;
      }

      console.log('Received research event:', event);
      setEvents((prev) => [...prev, event]);
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-scroll to bottom when new events arrive with smooth animation
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [events]);

  const startResearch = useCallback(async () => {
    console.log('[ResearchDemo] startResearch called');
    
    if (!instructions.trim()) {
      alert('Please enter research instructions');
      return;
    }

    console.log('[ResearchDemo] Starting research with instructions:', instructions);
    
    setIsResearching(true);
    setEvents([]);
    setFinalResult(null);
    hasCompletedRef.current = false;

    try {
      const result = await window.context.performDeepResearch({
        instructions: instructions.trim(),
        model: 'exa-research',
      });

      console.log('[ResearchDemo] Research complete:', result);
      setFinalResult(result);
      
      // Upload research summary to Supabase
      try {
        const uploadResult = await window.context.uploadResearchSummary(result);
        if (uploadResult.success) {
          console.log('[ResearchDemo] Research summary uploaded successfully');
        } else {
          console.error('[ResearchDemo] Failed to upload research summary:', uploadResult.error);
        }
      } catch (uploadError) {
        console.error('[ResearchDemo] Error uploading research summary:', uploadError);
      }
      
      // Call onComplete callback if provided
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Research error:', error);
      alert(`Research failed: ${error}`);
    } finally {
      setIsResearching(false);
    }
  }, [instructions, onComplete]);

  // Auto-start research if enabled
  useEffect(() => {
    if (autoStart && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      console.log('[ResearchDemo] Auto-starting research...');
      
      // Start immediately
      startResearch();
    }
  }, [autoStart, startResearch]);

  const clearEvents = () => {
    setEvents([]);
    setFinalResult(null);
  };

  // Build a stable mapping of planId -> iteration number based on first appearance order
  const planIdToIteration = useMemo(() => {
    const map = new Map<string, number>();
    let iterationCounter = 0;
    for (const event of events) {
      const planId = (event as any).planId as string | undefined;
      if (planId && !map.has(planId)) {
        iterationCounter += 1;
        map.set(planId, iterationCounter);
      }
    }
    return map;
  }, [events]);

  const getPlanIteration = useCallback((planId?: string) => {
    if (!planId) return undefined;
    return planIdToIteration.get(planId);
  }, [planIdToIteration]);

  // Process events to determine which ones are currently processing
  const hasCompletionEvent = events.some(e => e.eventType === 'research-output');
  const eventsUpToCompletion = useMemo(() => {
    if (!hasCompletionEvent) return events;
    const idx = events.findIndex(e => e.eventType === 'research-output');
    return events.slice(0, idx + 1);
  }, [events, hasCompletionEvent]);
  const processedEvents: ProcessedEvent[] = eventsUpToCompletion.map((event, index) => {
    const isLast = index === eventsUpToCompletion.length - 1;
    // Don't show processing animation if we already have a completion event
    const isProcessing = isResearching && isLast && event.eventType !== 'research-output' && !hasCompletionEvent;
    
    return {
      event,
      isProcessing,
      timestamp: new Date(event.createdAt).toLocaleTimeString(),
    };
  });

  // ChatGPT-style vertical carousel view
  if (showOnlyCurrentEvent) {
    return (
      <div className="w-full max-w-2xl mx-auto relative perspective-[1000px]">
        {/* Top fade gradient overlay */}
        <div className="absolute top-0 left-0 right-0 h-36 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
        
        <div 
          ref={scrollContainerRef}
          className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          style={{ 
            transformStyle: 'preserve-3d',
            transform: 'rotateX(2deg)'
          }}
        >
          {processedEvents.length === 0 && isResearching && (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Brain className="h-5 w-5 text-foreground animate-pulse flex-shrink-0" />
                <span className="text-base font-medium bg-gradient-to-r from-foreground via-foreground/60 to-foreground bg-[length:200%_100%] animate-shimmer bg-clip-text text-transparent">
                  Thinking...
                </span>
              </div>
            </Card>
          )}
          
          {processedEvents.map((item, index) => (
            <EventCarouselCard 
              key={index} 
              event={item.event}
              isProcessing={item.isProcessing}
              timestamp={item.timestamp}
              getPlanIteration={getPlanIteration}
            />
          ))}
          
          {finalResult && (
            <Card className="p-6 border-green-200 bg-green-50 dark:bg-green-950/20">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-foreground mt-1 flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <h3 className="font-semibold text-lg text-foreground">Research Complete</h3>
                  {finalResult.costDollars && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Cost: ${finalResult.costDollars.total.toFixed(4)}</p>
                      <p>{finalResult.costDollars.numSearches} searches • {finalResult.costDollars.numPages} pages analyzed • {finalResult.costDollars.reasoningTokens.toLocaleString()} tokens</p>
                    </div>
                  )}
                  {finalResult.output?.content && (
                    <div className="mt-4">
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">
                        {finalResult.output.content}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Full demo view
  return (
    <div className="p-6 space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Exa Research API Demo</h1>
        <p className="text-sm text-muted-foreground">
          This demo shows all the event types from Exa's Research API in real-time
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Research Instructions</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="w-full p-2 border rounded-md min-h-[100px] bg-background"
            placeholder="Enter your research question..."
            disabled={isResearching}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={startResearch} disabled={isResearching}>
            {isResearching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Researching...
              </>
            ) : (
              'Start Research'
            )}
          </Button>
          <Button onClick={clearEvents} variant="outline" disabled={isResearching}>
            Clear Events
          </Button>
        </div>
      </Card>

      {/* Events Display */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          Events ({processedEvents.length})
        </h2>
        
        <div className="border rounded-md p-4 max-h-[600px] overflow-y-auto bg-muted/30 space-y-3">
          {processedEvents.length === 0 && !finalResult && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No events yet. Start a research to see live updates.
            </p>
          )}

          {processedEvents.map((item, index) => (
            <EventCarouselCard 
              key={index} 
              event={item.event}
              isProcessing={item.isProcessing}
              timestamp={item.timestamp}
              getPlanIteration={getPlanIteration}
            />
          ))}

          {finalResult && (
            <Card className="p-6 border-green-200 bg-green-50 dark:bg-green-950/20">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-foreground mt-1 flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <h3 className="font-semibold text-lg text-foreground">Research Complete</h3>
                  {finalResult.costDollars && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Cost: ${finalResult.costDollars.total.toFixed(4)}</p>
                      <p>{finalResult.costDollars.numSearches} searches • {finalResult.costDollars.numPages} pages analyzed • {finalResult.costDollars.reasoningTokens.toLocaleString()} tokens</p>
                    </div>
                  )}
                  {finalResult.output?.content && (
                    <div className="mt-4">
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">
                        {finalResult.output.content}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ChatGPT-style event carousel card
function EventCarouselCard({ 
  event, 
  isProcessing, 
  timestamp,
  getPlanIteration,
}: { 
  event: ResearchEvent; 
  isProcessing: boolean; 
  timestamp: string;
  getPlanIteration: (planId?: string) => number | undefined;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getEventIcon = () => {
    switch (event.eventType) {
      case 'research-definition':
        return <FileText className="h-5 w-5 text-foreground flex-shrink-0" />;
      case 'research-output':
        return event.output.outputType === 'completed' 
          ? <CheckCircle2 className="h-5 w-5 text-foreground flex-shrink-0" />
          : <XCircle className="h-5 w-5 text-foreground flex-shrink-0" />;
      case 'plan-definition':
        return <Brain className="h-5 w-5 text-foreground flex-shrink-0" />;
      case 'plan-operation':
        return getOperationIcon(event.data.type);
      case 'plan-output':
        return <ListChecks className="h-5 w-5 text-foreground flex-shrink-0" />;
      case 'task-definition':
        return <ListChecks className="h-5 w-5 text-foreground flex-shrink-0" />;
      case 'task-operation':
        return getOperationIcon(event.data.type);
      case 'task-output':
        return <Lightbulb className="h-5 w-5 text-foreground flex-shrink-0" />;
      default:
        return <FileText className="h-5 w-5 text-foreground flex-shrink-0" />;
    }
  };

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'think': 
        return isProcessing 
          ? <Brain className="h-5 w-5 text-foreground flex-shrink-0 animate-pulse" />
          : <Brain className="h-5 w-5 text-foreground flex-shrink-0" />;
      case 'search': 
        return isProcessing
          ? <Search className="h-5 w-5 text-foreground flex-shrink-0 animate-pulse" />
          : <Search className="h-5 w-5 text-foreground flex-shrink-0" />;
      case 'crawl': 
        return isProcessing
          ? <FileText className="h-5 w-5 text-foreground flex-shrink-0 animate-pulse" />
          : <FileText className="h-5 w-5 text-foreground flex-shrink-0" />;
      default: 
        return <FileText className="h-5 w-5 text-foreground flex-shrink-0" />;
    }
  };

  const getEventTitle = () => {
    switch (event.eventType) {
      case 'research-definition':
        return 'Research Definition';
      case 'research-output':
        return event.output.outputType === 'completed' ? 'Research Complete' : 'Research Failed';
      case 'plan-definition':
        {
          const iter = getPlanIteration((event as any).planId);
          return iter ? `Creating Research Plan (Agent ${iter})` : 'Creating Research Plan';
        }
      case 'plan-operation':
        if (event.data.type === 'think') return 'Analyzing';
        if (event.data.type === 'search') return 'Searching Web';
        if (event.data.type === 'crawl') return 'Reading Page';
        return 'Plan Operation';
      case 'plan-output':
        {
          const iter = getPlanIteration((event as any).planId);
          const suffix = iter ? ` (Agent ${iter})` : '';
          return event.output.outputType === 'tasks' ? `Creating Tasks${suffix}` : `Planning Complete${suffix}`;
        }
      case 'task-definition':
        {
          const iter = getPlanIteration((event as any).planId);
          return iter ? `Starting Task (Agent ${iter})` : 'Starting Task';
        }
      case 'task-operation':
        {
          const iter = getPlanIteration((event as any).planId);
          const suffix = iter ? ` (Agent ${iter})` : '';
          if (event.data.type === 'think') return `Processing${suffix}`;
          if (event.data.type === 'search') return `Searching${suffix}`;
          if (event.data.type === 'crawl') return `Analyzing Page${suffix}`;
          return `Task Operation${suffix}`;
        }
      case 'task-output':
        {
          const iter = getPlanIteration((event as any).planId);
          return iter ? `Task Complete (Agent ${iter})` : 'Task Complete';
        }
      default:
        return 'Event';
    }
  };

  const getEventContent = () => {
    switch (event.eventType) {
      case 'research-definition':
        return event.instructions;
      case 'research-output':
        if (event.output.outputType === 'completed') {
          return event.output.costDollars 
            ? `Completed research using ${event.output.costDollars.numSearches} searches and ${event.output.costDollars.numPages} pages`
            : 'Research completed successfully';
        }
        return event.output.error || 'Research failed';
      case 'plan-definition':
        return 'Analyzing requirements and planning research approach...';
      case 'plan-operation':
        if (event.data.type === 'think' && event.data.content) {
          return event.data.content;
        }
        if (event.data.type === 'search') {
          return `"${event.data.query}" - ${event.data.results?.length || 0} results found`;
        }
        if (event.data.type === 'crawl') {
          return event.data.result?.url || 'Crawling page...';
        }
        return 'Performing operation...';
      case 'plan-output':
        if (event.output.outputType === 'tasks' && event.output.tasksInstructions) {
          return `Creating ${event.output.tasksInstructions.length} parallel research tasks:\n${event.output.tasksInstructions.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
        }
        return event.output.reasoning;
      case 'task-definition':
        return event.instructions;
      case 'task-operation':
        if (event.data.type === 'think' && event.data.content) {
          return event.data.content;
        }
        if (event.data.type === 'search') {
          return `"${event.data.query}" - ${event.data.results?.length || 0} results`;
        }
        if (event.data.type === 'crawl') {
          return event.data.result?.url || 'Analyzing page...';
        }
        return 'Processing task...';
      case 'task-output':
        return event.output.content;
      default:
        return '';
    }
  };

  const content = getEventContent();
  const title = getEventTitle();
  const shouldTruncate = content.length > 200;
  const displayContent = isExpanded ? content : content.substring(0, 200);

  return (
    <Card className="p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-3">
        {getEventIcon()}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            {isProcessing ? (
              <h4 className="font-semibold text-sm bg-gradient-to-r from-foreground via-foreground/60 to-foreground bg-[length:200%_100%] animate-shimmer bg-clip-text text-transparent">
                {title}
              </h4>
            ) : (
              <h4 className="font-semibold text-sm">{title}</h4>
            )}
            <span className="text-xs text-muted-foreground whitespace-nowrap">{timestamp}</span>
          </div>
          
          <div className="text-sm text-muted-foreground leading-relaxed">
            {isProcessing ? (
              <span className="bg-gradient-to-r from-muted-foreground via-muted-foreground/60 to-muted-foreground bg-[length:200%_100%] animate-shimmer bg-clip-text text-transparent">
                {displayContent}
              </span>
            ) : (
              <>
                <div className="whitespace-pre-wrap break-words">
                  {displayContent}
                  {!isExpanded && shouldTruncate && '...'}
                </div>
                {shouldTruncate && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-primary hover:underline text-xs mt-2 flex items-center gap-1"
                  >
                    {isExpanded ? 'Show less' : 'Show more'}
                    <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Additional metadata for specific event types */}
          {event.eventType === 'plan-operation' && event.data.type === 'crawl' && event.data.pageTokens && !isProcessing && (
            <div className="text-xs text-muted-foreground">
              {event.data.pageTokens.toLocaleString()} tokens processed
            </div>
          )}
          
          {event.eventType === 'task-operation' && event.data.type === 'crawl' && event.data.pageTokens && !isProcessing && (
            <div className="text-xs text-muted-foreground">
              {event.data.pageTokens.toLocaleString()} tokens processed
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
