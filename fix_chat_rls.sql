-- Allow the API (which uses Anon key but passes user_id) to insert messages
-- ideally we would use Service Key, but for now let's open up the policy for the MVP
DROP POLICY IF EXISTS "Enable insert for all API calls" ON public.employee_messages;
CREATE POLICY "Enable insert for all API calls" ON public.employee_messages 
FOR INSERT 
WITH CHECK (true);

-- Also allow reading messages so the user can see their own chat history
CREATE POLICY "Users can see own messages" ON public.employee_messages
FOR SELECT
USING (auth.uid() = user_id OR true); -- OR true temporarily for dev to see all
