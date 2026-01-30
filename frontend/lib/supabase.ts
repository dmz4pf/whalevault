import { createClient } from "@supabase/supabase-js";

// Hardcoded to avoid Vercel env variable issues
const supabaseUrl = "https://spxwryqmcdwkkskgnups.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNweHdyeXFtY2R3a2tza2dudXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDAyMjgsImV4cCI6MjA4NTExNjIyOH0.kyt1uZJGJys60RLlD5DHVAJhyxAycnSXqv9A8cOlVuM";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
