import '../styles/globals.css';
import React from 'react';

export const metadata = {
  title: 'Soboite',
  description: 'Next.js + Supabase starter',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Fallback static CSS bundle if PostCSS/Turbopack misses processing */}
        <link rel="stylesheet" href="/tailwind.css" />
      </head>
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <main className="max-w-3xl mx-auto p-6">{children}</main>
      </body>
    </html>
  );
}
