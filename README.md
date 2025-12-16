# Soboite — Next.js + Supabase Starter

Minimal Next.js (App Router) starter configured with TypeScript, Tailwind CSS, and a reusable Supabase client.

Quick start

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from the example and fill values:

```powershell
copy .env.local.example .env.local
# then edit .env.local and add your Supabase URL and anon key
```

3. Run the dev server:

```bash
npm run dev
```

Files of interest
- `lib/supabaseClient.ts` — reusable Supabase client
- `app/page.tsx` — simple home page that checks Supabase
- `components/SupabaseStatus.tsx` — client component that queries a table and shows result
