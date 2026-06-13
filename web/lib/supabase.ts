import { createClient } from "@supabase/supabase-js";

// Fallback to a placeholder so the client can be constructed (and modules that
// import it can load) before real Supabase credentials are configured in
// .env.local. Calls will simply fail until then.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
