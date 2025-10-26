-- Migration: Create atomic insert_activity_stat function
-- Purpose: Prevent race conditions in seq_time calculation
-- Date: 2025-10-26

-- Create an index for better performance when fetching most recent activity
CREATE INDEX IF NOT EXISTS idx_stats_email_created_at 
ON stats(email, created_at DESC);

-- Create atomic function to handle activity stat inserts
-- This function ensures seq_time is calculated correctly even with concurrent inserts
CREATE OR REPLACE FUNCTION insert_activity_stat(
  p_email TEXT,
  p_description TEXT,
  p_on_goal BOOLEAN,
  p_seconds BIGINT,
  p_task task_enum,
  p_same_task BOOLEAN
)
RETURNS TABLE(new_id uuid, new_seq_time bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq_time BIGINT;
  v_previous_seq_time BIGINT;
  v_new_id uuid;
BEGIN
  -- Acquire an advisory lock for this specific email
  -- This prevents race conditions when multiple screenshots are analyzed concurrently
  -- The lock is automatically released at the end of the transaction
  -- Using hashtext() allows different users to insert concurrently
  PERFORM pg_advisory_xact_lock(hashtext(p_email));
  
  -- Get the most recent seq_time for this user
  SELECT seq_time INTO v_previous_seq_time
  FROM stats
  WHERE email = p_email
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Calculate new seq_time atomically
  IF p_same_task AND v_previous_seq_time IS NOT NULL THEN
    -- Same task: increment from previous seq_time
    v_seq_time := v_previous_seq_time + p_seconds;
  ELSE
    -- Different task or first activity: start fresh
    v_seq_time := p_seconds;
  END IF;
  
  -- Insert the new record
  INSERT INTO stats (email, description, on_goal, seconds, seq_time, task)
  VALUES (p_email, p_description, p_on_goal, p_seconds, v_seq_time, p_task)
  RETURNING id INTO v_new_id;
  
  -- Return both the new ID and seq_time for logging/verification
  RETURN QUERY SELECT v_new_id, v_seq_time;
  
  -- Advisory lock is automatically released when transaction ends
END;
$$;

-- Grant execute permissions
-- These permissions allow your Electron app to call this function
GRANT EXECUTE ON FUNCTION insert_activity_stat TO service_role;
GRANT EXECUTE ON FUNCTION insert_activity_stat TO authenticated;
GRANT EXECUTE ON FUNCTION insert_activity_stat TO anon;

-- Verify the function was created successfully
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'insert_activity_stat';

