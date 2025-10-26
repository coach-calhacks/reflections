import { electronAPI } from "@electron-toolkit/preload";
export type GetVersionsFn = () => Promise<typeof electronAPI.process.versions>;

// Screen capture types
export interface ScreenCaptureStatus {
  isCapturing: boolean;
  interval: number; // in seconds
  saveFolder: string;
  lastCaptureTime?: string;
}

export type StartScreenCaptureFn = (interval: number) => Promise<{ success: boolean; message: string }>;
export type StopScreenCaptureFn = () => Promise<void>;
export type GetScreenCaptureStatusFn = () => Promise<ScreenCaptureStatus>;
export type SetScreenCaptureIntervalFn = (interval: number) => Promise<void>;
export type GetScreenCaptureFolderFn = () => Promise<string>;

// Google Auth types
export interface GoogleAuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number;
  error?: string;
  userInfo?: {
    id: string;
    email: string;
    name: string;
    picture: string;
  };
}

export type SignInWithGoogleFn = () => Promise<GoogleAuthResult>;

// Web Research types (Exa Research API)
export interface ResearchOptions {
  instructions: string;
  model?: 'exa-research-fast' | 'exa-research' | 'exa-research-pro';
  outputSchema?: Record<string, any>;
}

// Event types for streaming research
export type ResearchEventType = 
  | 'research-definition'
  | 'research-output'
  | 'plan-definition'
  | 'plan-operation'
  | 'plan-output'
  | 'task-definition'
  | 'task-operation'
  | 'task-output';

export interface ResearchDefinitionEvent {
  eventType: 'research-definition';
  instructions: string;
  outputSchema?: Record<string, any>;
  createdAt: number;
  researchId: string;
}

export interface ResearchOutputEvent {
  eventType: 'research-output';
  output: {
    outputType: 'completed' | 'failed';
    costDollars?: {
      total: number;
      numSearches: number;
      numPages: number;
      reasoningTokens: number;
    };
    content?: string;
    parsed?: Record<string, any>;
    error?: string;
  };
  createdAt: number;
  researchId: string;
}

export interface PlanDefinitionEvent {
  eventType: 'plan-definition';
  planId: string;
  createdAt: number;
  researchId: string;
}

export interface PlanOperationEvent {
  eventType: 'plan-operation';
  planId: string;
  operationId: string;
  data: {
    type: 'think' | 'search' | 'crawl';
    content?: string;
    searchType?: 'neural' | 'keyword' | 'auto' | 'fast';
    goal?: string;
    query?: string;
    results?: Array<{ url: string }>;
    result?: { url: string };
    pageTokens?: number;
  };
  createdAt: number;
  researchId: string;
}

export interface PlanOutputEvent {
  eventType: 'plan-output';
  planId: string;
  output: {
    outputType: 'tasks' | 'stop';
    reasoning: string;
    tasksInstructions?: string[];
  };
  createdAt: number;
  researchId: string;
}

export interface TaskDefinitionEvent {
  eventType: 'task-definition';
  planId: string;
  taskId: string;
  instructions: string;
  createdAt: number;
  researchId: string;
}

export interface TaskOperationEvent {
  eventType: 'task-operation';
  planId: string;
  taskId: string;
  operationId: string;
  data: {
    type: 'think' | 'search' | 'crawl';
    content?: string;
    searchType?: 'neural' | 'keyword' | 'auto' | 'fast';
    goal?: string;
    query?: string;
    results?: Array<{ url: string }>;
    result?: { url: string };
    pageTokens?: number;
  };
  createdAt: number;
  researchId: string;
}

export interface TaskOutputEvent {
  eventType: 'task-output';
  planId: string;
  taskId: string;
  output: {
    outputType: 'completed';
    content: string;
  };
  createdAt: number;
  researchId: string;
}

export type ResearchEvent =
  | ResearchDefinitionEvent
  | ResearchOutputEvent
  | PlanDefinitionEvent
  | PlanOperationEvent
  | PlanOutputEvent
  | TaskDefinitionEvent
  | TaskOperationEvent
  | TaskOutputEvent;

export interface ResearchResponse {
  researchId: string;
  createdAt: number;
  model: string;
  instructions: string;
  status: 'pending' | 'running' | 'completed' | 'canceled' | 'failed';
  events?: ResearchEvent[];
  output?: {
    content: string;
    parsed?: Record<string, any>;
  };
  costDollars?: {
    total: number;
    numSearches: number;
    numPages: number;
    reasoningTokens: number;
  };
  error?: string;
  finishedAt?: number;
}

export type PerformDeepResearchFn = (options: ResearchOptions) => Promise<ResearchResponse>;
export type OnResearchEventFn = (event: ResearchEvent) => void;

// Stats types
export interface TaskStats {
  task: 'Analytical' | 'Creative' | 'Reading' | 'Social Media' | 'Watching' | 'Conversation';
  count: number;
  total_seconds: number;
  total_hours: number;
}

export type GetTaskStatsFn = () => Promise<TaskStats[]>;

// FaceTime Call types
export type SetFaceTimeCallActiveFn = (isActive: boolean) => Promise<void>;

// Prompt configuration types
export interface PromptConfig {
  prompt: string;
  warning_message?: string;
}

export type GetPromptConfigFn = (email: string) => Promise<PromptConfig>;
