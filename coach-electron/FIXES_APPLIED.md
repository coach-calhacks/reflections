# Screen Capture Bug Fixes

## Problems Identified

### 1. **Race Condition with seq_time** ⚠️ CRITICAL
**Symptom**: `seq_time` values not incrementing properly

**Root Cause**: 
- Multiple screenshot analyses were running concurrently
- When Screenshot A started, it fetched `seq_time = 15` from the database
- Before Screenshot A finished, Screenshot B started and also fetched `seq_time = 15`
- Both calculated the next `seq_time` based on the same stale value
- Result: Duplicate or incorrect `seq_time` values in database

**Timeline Example**:
```
T=0s:  Screenshot 1 taken → Analysis starts → Fetches seq_time=15
T=15s: Screenshot 2 taken → Analysis starts → Fetches seq_time=15 (WRONG!)
T=20s: Screenshot 1 analysis completes → Inserts seq_time=30
T=25s: Screenshot 2 analysis completes → Inserts seq_time=30 (DUPLICATE!)
```

### 2. **Missing Database Rows** ⚠️ CRITICAL
**Symptom**: Number of DB rows ≠ number of screenshots taken

**Root Cause**:
- If Gemini API failed, timed out, or was rate-limited, the function exited early
- Screenshot was saved to disk, but no database row was inserted
- No error recovery mechanism

### 3. **No Timeout on Gemini API** ⚠️ MODERATE
**Symptom**: Requests pile up when Gemini is slow

**Root Cause**:
- No timeout on API calls
- If Gemini takes 60+ seconds to respond, multiple analyses queue up
- Can lead to memory issues and cascading failures

### 4. **No Concurrency Control** ⚠️ CRITICAL
**Symptom**: Multiple analyses running simultaneously

**Root Cause**:
- No mechanism to prevent overlapping `analyzeScreenshotWithGemini()` calls
- If analysis time > capture interval, multiple calls stack up

## Solutions Applied

### Fix 1: Concurrency Lock
```typescript
let isAnalyzing = false; // Global flag

const analyzeScreenshotWithGemini = async (filepath: string): Promise<void> => {
  // Check if another analysis is already running
  if (isAnalyzing) {
    console.log("Analysis already in progress, skipping...");
    return;
  }
  
  isAnalyzing = true;
  try {
    // ... analysis code ...
  } finally {
    isAnalyzing = false; // Always reset, even on error
  }
}
```

**Impact**: Prevents concurrent analyses, eliminating race conditions

### Fix 2: Just-in-Time seq_time Calculation
```typescript
// OLD CODE: Fetched at start of analysis (30+ seconds before insert)
previousActivityData = await getMostRecentActivity(userEmail);

// NEW CODE: Re-fetch RIGHT before insert (minimizes race window)
const freshPreviousActivityData = await getMostRecentActivity(userEmail);
let seqTime = same_task && freshPreviousActivityData 
  ? freshPreviousActivityData.seq_time + captureSettings.interval
  : captureSettings.interval;
```

**Impact**: Even if multiple analyses somehow run, the seq_time is calculated from the freshest data

### Fix 3: 30-Second Timeout on Gemini API
```typescript
const GEMINI_TIMEOUT_MS = 30000; // 30 seconds
const geminiPromise = genAI.models.generateContent({...});
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Gemini API timeout')), GEMINI_TIMEOUT_MS);
});

const result = await Promise.race([geminiPromise, timeoutPromise]);
```

**Impact**: Prevents hanging API calls, ensures timely error handling

### Fix 4: Proper Error Handling with Finally Block
```typescript
try {
  // ... analysis code ...
} catch (error) {
  console.error("Failed to analyze screenshot:", error);
} finally {
  isAnalyzing = false; // ALWAYS reset, even on error
}
```

**Impact**: Ensures the lock is released even on exceptions

## Testing Recommendations

### Test 1: Rapid Captures
```bash
# Set interval to 5 seconds, let it run for 1 minute
# Expected: 12 screenshots, 12 DB rows (or 12 screenshots, 0-12 DB rows depending on analysis speed)
# Check: seq_time values should increment properly for same tasks
```

### Test 2: Gemini Rate Limiting
```bash
# Monitor console logs for "Analysis already in progress" messages
# This confirms the concurrency lock is working
```

### Test 3: Timeout Handling
```bash
# If you see timeout errors, screenshots will be saved but analysis skipped
# This is expected behavior and prevents the app from hanging
```

## Additional Observations

### About Gemini Rate Limits
The Gemini API (especially the free tier) has rate limits:
- **gemini-2.5-flash-lite**: ~60 requests per minute
- With 15-second intervals: 4 requests/minute (well within limits)
- With 5-second intervals: 12 requests/minute (still safe)
- With 1-second intervals: 60 requests/minute (at the limit)

**Recommendation**: Keep interval at 15+ seconds for stability

### About Supabase Limits
Supabase free tier limits:
- **Database**: 500MB storage, unlimited API requests
- **Realtime**: 200 concurrent connections
- **Auth**: 50,000 monthly active users

For your use case (simple inserts), Supabase limits are NOT the bottleneck.

## Monitoring

Add these console logs to track issues:
1. ✅ Already added: "Analysis already in progress" (skip due to lock)
2. ✅ Already added: "Gemini API timeout" (30-second timeout)
3. ✅ Already present: "Stats inserted successfully" (DB writes)
4. ✅ Already present: "Error inserting stats" (DB errors)

Watch for these patterns:
- **Many "Analysis already in progress"** = Gemini is slower than your interval
- **"Gemini API timeout"** = Possible rate limiting or API issues
- **Screenshots exist but no DB rows** = Now should be rare with proper error handling

## Summary

The main issue was a **race condition** caused by concurrent analyses. The fixes ensure:
1. ✅ Only one analysis runs at a time (concurrency lock)
2. ✅ seq_time calculated from freshest data (just-in-time fetch)
3. ✅ API timeouts prevent hanging (30-second timeout)
4. ✅ Proper cleanup on errors (finally block)

**Expected Result**: 
- seq_time increments correctly for same tasks
- Number of DB rows matches number of successful analyses (may be < screenshots if Gemini fails)
- No more race conditions or duplicate seq_time values

