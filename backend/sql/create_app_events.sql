CREATE TABLE IF NOT EXISTS public.app_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type varchar(50) NOT NULL,
  message text NOT NULL,
  link_url varchar(255),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id varchar(255)
);

-- Enable Row Level Security
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view events
CREATE POLICY "Enable read access for all users on app_events"
  ON public.app_events FOR SELECT
  USING (true);

-- Policy: Anyone can insert events (or you can restrict this to authenticated admins if you have auth, but currently the app allows anonymous/api inserts)
CREATE POLICY "Enable insert access for all users on app_events"
  ON public.app_events FOR INSERT
  WITH CHECK (true);
