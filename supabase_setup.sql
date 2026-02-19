-- 1. Create the Profile Table if it doesn't exist (it should)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'employee',
  current_status TEXT DEFAULT 'offline',
  last_seen TIMESTAMP WITH TIME ZONE,
  company_id UUID REFERENCES public.companies(id)
);

-- 2. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create Policy: Allow Public Read (or Authenticated) - For simplicity in MVP, let's allow authenticated read
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING ( true );

-- 4. Create Policy: Allow Users to Update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING ( auth.uid() = id );

-- 5. FUNCTION & TRIGGER: Auto-create Profile on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'employee');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger logic
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. FIX: Drop the restrictive constraint if it exists (so we can add 'admin')
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- Re-add with 'admin' allowed
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('employee', 'manager', 'admin'));

-- 7. Insert a placeholder profile for YOU (the admin)
INSERT INTO public.profiles (id, full_name, role)
SELECT id, raw_user_meta_data->>'full_name', 'admin'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);
