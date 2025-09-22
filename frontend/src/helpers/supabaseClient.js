import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uhotboeabldolkimovld.supabase.co';
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVob3Rib2VhYmxkb2xraW1vdmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNjc4ODgsImV4cCI6MjA3Mzk0Mzg4OH0.7tuNPiHdx66BQJpfx_tAro14XGg-YaSahIJ8j71QgOU";

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
