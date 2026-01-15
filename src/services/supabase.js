import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;

// Note: This is a public publishable key. Do not use it for sensitive operations.
// For vercel deployment, make sure to set the environment variables in the Vercel dashboard.
