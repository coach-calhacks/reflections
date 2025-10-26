/**
 * Exa Research API Handler
 * Performs deep research on a given topic using Exa's research API
 * with real-time streaming support
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import type {
  ResearchOptions,
  ResearchResponse,
  ResearchEvent,
} from '@shared/types';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const EXA_API_KEY = process.env.EXA_API_KEY;
const EXA_API_BASE_URL = 'https://api.exa.ai/research/v1';

// Debug logging toggle
const EXA_DEBUG = process.env.EXA_DEBUG === '1' || process.env.EXA_DEBUG === 'true';
function dlog(...args: unknown[]): void {
  if (EXA_DEBUG) console.log('[Exa Research][DEBUG]', ...args);
}

if (!EXA_API_KEY) {
  console.warn('EXA_API_KEY not found in environment variables. Research functionality will not work.');
}

/**
 * Main function to perform deep web research using Exa API
 * This function creates a research task and polls for completion with streaming
 */
export async function performDeepResearch(
  options: ResearchOptions,
  onEvent?: (event: ResearchEvent) => void
): Promise<ResearchResponse> {
  if (!EXA_API_KEY) {
    throw new Error('EXA_API_KEY is not configured. Please set it in your .env file.');
  }

  try {
    const { instructions, model = 'exa-research', outputSchema } = options;

    console.log(`[Exa Research] Starting research with model: ${model}`);
    console.log(`[Exa Research] Instructions: ${instructions}`);
    dlog('EXA_DEBUG enabled =', EXA_DEBUG);

    // Step 1: Create the research task
    const createResponse = await fetch(EXA_API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EXA_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        instructions,
        ...(outputSchema && { outputSchema }),
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create research task: ${createResponse.status} ${errorText}`);
    }

    const createData: ResearchResponse = await createResponse.json();
    const { researchId } = createData;

    console.log(`[Exa Research] Research created with ID: ${researchId}`);
    dlog('Create response status =', createResponse.status, 'initial status =', createData.status);

    // Step 2: Stream the research progress
    const finalResult = await streamResearchProgress(researchId, onEvent);

    return finalResult;
  } catch (error) {
    console.error('[Exa Research] Error:', error);
    throw error;
  }
}

/**
 * Stream research progress using Server-Sent Events (SSE)
 */
async function streamResearchProgress(
  researchId: string,
  onEvent?: (event: ResearchEvent) => void
): Promise<ResearchResponse> {
  return new Promise((resolve, reject) => {
    const streamUrl = `${EXA_API_BASE_URL}/${researchId}?stream=true&events=true`;
    
    console.log(`[Exa Research] Streaming from: ${streamUrl}`);
    dlog('Opening SSE stream for researchId =', researchId);

    let buffer = '';
    let finalResponse: ResearchResponse | null = null;
    let sseLineCount = 0;
    let sseDataCount = 0;
    let parseErrors = 0;
    let seenCompletion = false;
    const seenEventKeys = new Set<string>();

    function truncate(str: string, len = 180): string {
      return str.length > len ? `${str.slice(0, len)}…` : str;
    }

    function getEventKey(event: ResearchEvent): string {
      switch (event.eventType) {
        case 'research-definition':
          return `research-definition:${event.createdAt}`;
        case 'research-output':
          return `research-output:${event.createdAt}:${event.output.outputType}`;
        case 'plan-definition':
          return `plan-definition:${event.planId}`;
        case 'plan-operation':
          return `plan-operation:${event.planId}:${event.operationId}`;
        case 'plan-output':
          return `plan-output:${event.planId}:${event.output.outputType}:${event.createdAt}`;
        case 'task-definition':
          return `task-definition:${event.planId}:${event.taskId}`;
        case 'task-operation':
          return `task-operation:${event.planId}:${event.taskId}:${event.operationId}`;
        case 'task-output':
          return `task-output:${event.planId}:${event.taskId}:${event.createdAt}`;
        default:
          return `unknown:${(event as any).eventType || 'na'}:${(event as any).createdAt || 'na'}`;
      }
    }

    fetch(streamUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${EXA_API_KEY}`,
        'Accept': 'text/event-stream',
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to stream research: ${response.status} ${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Failed to get response reader');
        }

        const decoder = new TextDecoder();

        // Read the stream
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('[Exa Research] Stream complete');
            dlog('Stream reader done. sseLineCount =', sseLineCount, 'sseDataCount =', sseDataCount, 'parseErrors =', parseErrors, 'seenCompletion =', seenCompletion);
            break;
          }

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });
          dlog('Received chunk bytes =', value?.byteLength ?? 0, 'buffer length =', buffer.length);

          // Process complete SSE messages
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            sseLineCount++;
            if (line.startsWith('data: ')) {
              const data = line.slice(6); // Remove 'data: ' prefix
              sseDataCount++;
              dlog('SSE data line #', sseDataCount, truncate(data));
              
              if (data === '[DONE]') {
                console.log('[Exa Research] Received [DONE] signal');
                dlog('SSE [DONE] received');
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                
                // Check if this is a full response or an event
                if (parsed.researchId && parsed.status) {
                  // This is a full research response
                  finalResponse = parsed as ResearchResponse;
                  dlog('Snapshot response: status =', parsed.status, 'events =', Array.isArray(parsed.events) ? parsed.events.length : 0);
                  if (parsed.status === 'completed') {
                    seenCompletion = true;
                  }
                  
                  // If we have events in the response, emit them
                  if (parsed.events && Array.isArray(parsed.events)) {
                    for (const event of parsed.events) {
                      if (onEvent) {
                        onEvent(event as ResearchEvent);
                      }
                      logEvent(event);
                      try {
                        const key = getEventKey(event as ResearchEvent);
                        if (seenEventKeys.has(key)) {
                          dlog('Duplicate event (snapshot):', key, 'type =', (event as ResearchEvent).eventType);
                        } else {
                          seenEventKeys.add(key);
                          if (seenCompletion) {
                            dlog('Post-completion event (snapshot):', key, 'type =', (event as ResearchEvent).eventType);
                          }
                        }
                      } catch (e) {
                        dlog('Failed to compute event key for snapshot event:', e);
                      }
                    }
                  }

                  // If research is completed or failed, we can resolve
                  if (parsed.status === 'completed' || parsed.status === 'failed') {
                    resolve(finalResponse);
                    dlog('Resolving stream due to terminal status =', parsed.status);
                    return;
                  }
                } else if (parsed.eventType) {
                  // This is a single event
                  const event = parsed as ResearchEvent;
                  if (onEvent) {
                    onEvent(event);
                  }
                  logEvent(event);
                  try {
                    const key = getEventKey(event);
                    if (seenEventKeys.has(key)) {
                      dlog('Duplicate event (single):', key, 'type =', event.eventType);
                    } else {
                      seenEventKeys.add(key);
                      if (seenCompletion) {
                        dlog('Post-completion event (single):', key, 'type =', event.eventType);
                      }
                    }
                  } catch (e) {
                    dlog('Failed to compute event key for single event:', e);
                  }
                }
              } catch (parseError) {
                console.error('[Exa Research] Failed to parse SSE data:', parseError);
                parseErrors++;
                dlog('Parse error on data:', truncate(data));
              }
            }
          }
        }

        // If we didn't get a final response during streaming, fetch it
        if (!finalResponse) {
          console.log('[Exa Research] Fetching final result...');
          dlog('Fetching final result via REST fallback. seenCompletion =', seenCompletion);
          finalResponse = await fetchResearchResult(researchId);
        }

        resolve(finalResponse);
      })
      .catch((error) => {
        console.error('[Exa Research] Stream error:', error);
        dlog('Stream error (caught):', error);
        reject(error);
      });
  });
}

/**
 * Fetch the final research result (fallback if streaming doesn't provide it)
 */
async function fetchResearchResult(researchId: string): Promise<ResearchResponse> {
  const response = await fetch(`${EXA_API_BASE_URL}/${researchId}?events=true`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${EXA_API_KEY}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch research result: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  dlog('Final result received from REST fallback. status =', json?.status, 'events =', Array.isArray(json?.events) ? json.events.length : 0);
  return json;
}

/**
 * Log research events to console with formatting
 */
function logEvent(event: ResearchEvent): void {
  const timestamp = new Date(event.createdAt).toISOString();
  
  switch (event.eventType) {
    case 'research-definition':
      console.log(`\n[${timestamp}] 📋 RESEARCH DEFINITION`);
      console.log(`  Instructions: ${event.instructions}`);
      break;

    case 'research-output':
      console.log(`\n[${timestamp}] 🎯 RESEARCH OUTPUT`);
      if (event.output.outputType === 'completed') {
        console.log(`  Status: Completed ✅`);
        if (event.output.costDollars) {
          console.log(`  Cost: $${event.output.costDollars.total.toFixed(4)}`);
          console.log(`  Searches: ${event.output.costDollars.numSearches}`);
          console.log(`  Pages: ${event.output.costDollars.numPages}`);
        }
        if (event.output.content) {
          console.log(`  Content Length: ${event.output.content.length} chars`);
        }
      } else {
        console.log(`  Status: Failed ❌`);
        console.log(`  Error: ${event.output.error}`);
      }
      break;

    case 'plan-definition':
      console.log(`\n[${timestamp}] 📝 PLAN DEFINITION`);
      console.log(`  Plan ID: ${event.planId}`);
      break;

    case 'plan-operation':
      console.log(`\n[${timestamp}] ⚙️  PLAN OPERATION`);
      console.log(`  Plan ID: ${event.planId}`);
      console.log(`  Operation ID: ${event.operationId}`);
      console.log(`  Type: ${event.data.type}`);
      if (event.data.type === 'think' && event.data.content) {
        console.log(`  Thinking: ${event.data.content.substring(0, 100)}...`);
      } else if (event.data.type === 'search') {
        console.log(`  Search Type: ${event.data.searchType}`);
        console.log(`  Query: ${event.data.query}`);
        console.log(`  Results: ${event.data.results?.length || 0} URLs`);
      } else if (event.data.type === 'crawl') {
        console.log(`  URL: ${event.data.result?.url}`);
        console.log(`  Page Tokens: ${event.data.pageTokens}`);
      }
      break;

    case 'plan-output':
      console.log(`\n[${timestamp}] 📊 PLAN OUTPUT`);
      console.log(`  Plan ID: ${event.planId}`);
      console.log(`  Output Type: ${event.output.outputType}`);
      console.log(`  Reasoning: ${event.output.reasoning}`);
      if (event.output.outputType === 'tasks' && event.output.tasksInstructions) {
        console.log(`  Tasks: ${event.output.tasksInstructions.length}`);
        event.output.tasksInstructions.forEach((task, i) => {
          console.log(`    ${i + 1}. ${task}`);
        });
      }
      break;

    case 'task-definition':
      console.log(`\n[${timestamp}] 📌 TASK DEFINITION`);
      console.log(`  Task ID: ${event.taskId}`);
      console.log(`  Plan ID: ${event.planId}`);
      console.log(`  Instructions: ${event.instructions}`);
      break;

    case 'task-operation':
      console.log(`\n[${timestamp}] 🔧 TASK OPERATION`);
      console.log(`  Task ID: ${event.taskId}`);
      console.log(`  Operation ID: ${event.operationId}`);
      console.log(`  Type: ${event.data.type}`);
      if (event.data.type === 'think' && event.data.content) {
        console.log(`  Thinking: ${event.data.content.substring(0, 100)}...`);
      } else if (event.data.type === 'search') {
        console.log(`  Search Type: ${event.data.searchType}`);
        console.log(`  Query: ${event.data.query}`);
        console.log(`  Results: ${event.data.results?.length || 0} URLs`);
      } else if (event.data.type === 'crawl') {
        console.log(`  URL: ${event.data.result?.url}`);
        console.log(`  Page Tokens: ${event.data.pageTokens}`);
      }
      break;

    case 'task-output':
      console.log(`\n[${timestamp}] ✅ TASK OUTPUT`);
      console.log(`  Task ID: ${event.taskId}`);
      console.log(`  Content Length: ${event.output.content.length} chars`);
      break;

    default:
      console.log(`\n[${timestamp}] ❓ UNKNOWN EVENT TYPE`);
      console.log(JSON.stringify(event, null, 2));
  }
}
