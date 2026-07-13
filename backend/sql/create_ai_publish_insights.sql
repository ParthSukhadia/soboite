-- Run this in your Supabase SQL Editor to create the ai_publish_insights table

CREATE TABLE public.ai_publish_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    caption TEXT,
    dishes_data JSONB, -- Array of { dishId, pros, cons, originalReviews }
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_publish_insights ENABLE ROW LEVEL SECURITY;

-- Allow service role access and public read
CREATE POLICY "Allow public read access" ON public.ai_publish_insights FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.ai_publish_insights FOR INSERT WITH CHECK (true);

