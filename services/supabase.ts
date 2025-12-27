import { createClient } from '@supabase/supabase-js';

// Configuration priorities:
// 1. Vite Environment Variables (Production/Local Build)
// 2. Window Object Injection (Legacy/Runtime injection)
// 3. Hardcoded Fallback (Demo)

// Safely access env to avoid "Cannot read properties of undefined"
const env = (import.meta as any).env || {};

const supabaseUrl = env.VITE_SUPABASE_URL || (window as any).SUPABASE_URL || 'https://rbkgdzqytqpcfezryxpg.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || (window as any).SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJia2dkenF5dHFwY2ZlenJ5eHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMjY1OTksImV4cCI6MjA4MTkwMjU5OX0.VXVh4n-T8a9pXHi1myqNwNCjRdxrR5X8cXaqrD8K0lE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);