import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://clratpzepthoadgzftvd.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscmF0cHplcHRob2FkZ3pmdHZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NDQyMTEsImV4cCI6MjEwOTEyMDIxMX0.ZK9uZALNnkv1Qgliw26uElkf1pXskXwSY6YzjjbhiiI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
