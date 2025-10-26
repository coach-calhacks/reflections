import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

export interface EmailAnalysisResult {
  success: boolean;
  analysis?: {
    emailOverview: {
      communicationStyle: 'formal' | 'informal' | 'mixed';
      averageEmailsPerDay: number;
      commonTopics: string[];
      responsePattern: string;
    };
    jobInference: {
      role: string;
      industry: string;
      seniorityLevel: 'entry' | 'mid' | 'senior' | 'executive' | 'unknown';
      confidence: number;
    };
    workEnvironment: {
      companyType: 'corporate' | 'startup' | 'freelance' | 'academic' | 'unknown';
      teamSize: 'small' | 'medium' | 'large' | 'unknown';
      workMode: 'remote' | 'hybrid' | 'office' | 'unknown';
    };
    personality: {
      communicationStyle: string;
      responsiveness: 'high' | 'medium' | 'low';
      traits: string[];
    };
  };
  error?: string;
  connectedAccountId?: string;
}

export interface AnalysisProgress {
  stage: 'authenticating' | 'fetching' | 'analyzing' | 'saving' | 'complete' | 'error';
  message: string;
  service: string;
}

let composioClientCache: any = null;

// Initialize Composio client using dynamic import (required for ES Module)
async function getComposioClient(): Promise<any> {
  if (!composioClientCache) {
    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) {
      throw new Error('COMPOSIO_API_KEY not found in environment variables');
    }
    
    // Dynamic import to handle ES Module in CommonJS context
    const { Composio } = await import('@composio/core');
    composioClientCache = new Composio({
      apiKey,
      toolkitVersions: {
        gmail: "20251024_00",
      },
    });
  }
  return composioClientCache;
}

// Get OpenAI client
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment variables');
  }
  return new OpenAI({ apiKey });
}

/**
 * Authenticate user with Composio and return connection
 */
export async function authenticateWithComposio(
  userId: string,
  onProgress?: (progress: AnalysisProgress) => void
): Promise<{ success: boolean; connectedAccountId?: string; error?: string }> {
  try {
    onProgress?.({
      stage: 'authenticating',
      message: 'Preparing authentication...',
      service: 'gmail',
    });

    const composio = await getComposioClient();
    
    // Get auth config ID from environment
    const authConfigId = process.env.COMPOSIO_GMAIL_AUTH_CONFIG_ID;
    if (!authConfigId) {
      throw new Error('COMPOSIO_GMAIL_AUTH_CONFIG_ID not found in environment variables');
    }
    
    // Create connection request
    const connectionRequest = await composio.connectedAccounts.link(
      userId,
      authConfigId,
      { callbackUrl: 'https://composio.dev' }
    );

    const redirectUrl = connectionRequest.redirectUrl;
    
    onProgress?.({
      stage: 'authenticating',
      message: 'Opening browser for authentication...',
      service: 'gmail',
    });
    
    // Open the URL in the default browser
    const { shell } = require('electron');
    await shell.openExternal(redirectUrl);

    onProgress?.({
      stage: 'authenticating',
      message: 'Waiting for authorization...',
      service: 'gmail',
    });

    // Wait for the connection to complete
    const connectedAccount = await composio.connectedAccounts.waitForConnection(
      connectionRequest.id
    );

    console.log(`[Composio] Successfully connected Gmail account`);

    return {
      success: true,
      connectedAccountId: connectedAccount.id,
    };
  } catch (error) {
    console.error('[Composio] Authentication error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown authentication error',
    };
  }
}

/**
 * Fetch last 50 emails using Composio
 */
async function fetchEmails(
  userId: string,
  onProgress?: (progress: AnalysisProgress) => void
): Promise<{ success: boolean; emails?: any[]; error?: string }> {
  try {
    onProgress?.({
      stage: 'fetching',
      message: 'Fetching your recent emails...',
      service: 'gmail',
    });

    const composio = await getComposioClient();
    const openai = getOpenAIClient();
    
    // Get tools for GMAIL_FETCH_EMAILS action
    const tools = await composio.tools.get(userId, { 
      tools: ['GMAIL_FETCH_EMAILS']
    });

    if (tools.length === 0) {
      return {
        success: false,
        error: 'No Gmail tools available. Please ensure the account is properly connected.',
      };
    }

    // Use OpenAI to call the tool
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that retrieves emails from Gmail. When using GMAIL_FETCH_EMAILS, always set max_results to the requested number.',
        },
        {
          role: 'user',
          content: 'Use the GMAIL_FETCH_EMAILS tool to fetch exactly 50 emails from my inbox. You MUST set the max_results parameter to 50. Include all email details.',
        },
      ],
      tools: tools,
      tool_choice: 'required', // Force tool usage
    });

    // Override parameters if OpenAI didn't set max_results correctly
    if (response.choices[0]?.message?.tool_calls) {
      const toolCall = response.choices[0].message.tool_calls[0] as any;
      if (toolCall?.function?.arguments) {
        const args = JSON.parse(toolCall.function.arguments);
        if (!args.max_results || args.max_results < 50) {
          args.max_results = 50;
          toolCall.function.arguments = JSON.stringify(args);
        }
      }
    }

    // Execute the tool calls through Composio
    const fetchResult = await composio.provider.handleToolCalls(userId, response);

    // Parse the emails from the result
    let emails: any[] = [];
    
    if (Array.isArray(fetchResult)) {
      for (const item of fetchResult) {
        if (item.content) {
          try {
            const content = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
            
            if (content.data?.messages) {
              emails = content.data.messages;
            }
          } catch (e) {
            console.error('[Composio] Error parsing email content:', e);
          }
        }
      }
    }

    console.log(`[Composio] Successfully fetched ${emails.length} emails`);

    if (emails.length === 0) {
      return {
        success: false,
        error: 'No emails found in the response. The Gmail account may be empty or permissions may be insufficient.',
      };
    }

    onProgress?.({
      stage: 'fetching',
      message: `Fetched ${emails.length} emails`,
      service: 'gmail',
    });

    return {
      success: true,
      emails: emails.slice(0, 50), // Ensure we only get 50
    };
  } catch (error) {
    console.error('[Composio] Email fetch error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch emails',
    };
  }
}

/**
 * Analyze emails with AI
 */
async function analyzeEmailsWithAI(
  emails: any[],
  onProgress?: (progress: AnalysisProgress) => void
): Promise<{ success: boolean; analysis?: any; error?: string }> {
  try {
    onProgress?.({
      stage: 'analyzing',
      message: 'Analyzing your email patterns...',
      service: 'gmail',
    });

    const openai = getOpenAIClient();

    // Prepare email summary for analysis (using subject, sender, preview)
    const emailSummary = emails.map((email, idx) => {
      const subject = email.subject || email.preview?.subject || 'No subject';
      const sender = email.sender || email.from || 'Unknown';
      const preview = email.preview?.body || email.messageText?.substring(0, 200) || 'No content';
      
      return `Email ${idx + 1}:
Subject: ${subject}
From: ${sender}
Preview: ${preview}
---`;
    }).join('\n\n');

    const analysisPrompt = `Analyze these ${emails.length} emails and provide insights about the user:

${emailSummary}

Based on these emails, provide a comprehensive analysis of:

1. Email Communication Overview:
   - Communication style (formal/informal/mixed)
   - Estimated average emails per day based on the sample
   - Common topics discussed
   - Response patterns

2. Job Inference:
   - Likely job role
   - Industry
   - Seniority level (entry/mid/senior/executive/unknown)
   - Confidence level in this assessment (0-100)

3. Work Environment:
   - Company type (corporate/startup/freelance/academic/unknown)
   - Estimated team size (small/medium/large/unknown)
   - Work mode (remote/hybrid/office/unknown)

4. Personality Traits:
   - Communication style description
   - Responsiveness level (high/medium/low)
   - Key personality traits (3-5 traits)

Respond in JSON format matching this structure:
{
  "emailOverview": {
    "communicationStyle": "formal|informal|mixed",
    "averageEmailsPerDay": number,
    "commonTopics": ["topic1", "topic2"],
    "responsePattern": "description"
  },
  "jobInference": {
    "role": "role name",
    "industry": "industry name",
    "seniorityLevel": "entry|mid|senior|executive|unknown",
    "confidence": number
  },
  "workEnvironment": {
    "companyType": "corporate|startup|freelance|academic|unknown",
    "teamSize": "small|medium|large|unknown",
    "workMode": "remote|hybrid|office|unknown"
  },
  "personality": {
    "communicationStyle": "description",
    "responsiveness": "high|medium|low",
    "traits": ["trait1", "trait2", "trait3"]
  }
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing email communication patterns and inferring professional and personality insights. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const analysisText = response.choices[0]?.message?.content;
    if (!analysisText) {
      throw new Error('No analysis returned from AI');
    }

    const analysis = JSON.parse(analysisText);

    onProgress?.({
      stage: 'analyzing',
      message: 'Analysis complete!',
      service: 'gmail',
    });

    return {
      success: true,
      analysis,
    };
  } catch (error) {
    console.error('[Analysis] AI analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze emails',
    };
  }
}

/**
 * Main function to perform complete email analysis
 */
export async function performEmailAnalysis(
  userId: string,
  onProgress?: (progress: AnalysisProgress) => void
): Promise<EmailAnalysisResult> {
  try {
    // Step 1: Authenticate
    const authResult = await authenticateWithComposio(userId, onProgress);
    if (!authResult.success) {
      return {
        success: false,
        error: authResult.error,
      };
    }

    // Step 2: Fetch emails
    const fetchResult = await fetchEmails(userId, onProgress);
    if (!fetchResult.success || !fetchResult.emails || fetchResult.emails.length === 0) {
      return {
        success: false,
        error: fetchResult.error || 'No emails found',
      };
    }

    // Step 3: Analyze with AI
    const analysisResult = await analyzeEmailsWithAI(fetchResult.emails, onProgress);
    if (!analysisResult.success) {
      return {
        success: false,
        error: analysisResult.error,
      };
    }

    return {
      success: true,
      analysis: analysisResult.analysis,
      connectedAccountId: authResult.connectedAccountId,
    };
  } catch (error) {
    console.error('[EmailAnalysis] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error during analysis',
    };
  }
}

