import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Server-side client for simple SELECTs
export const supabaseServer = createClient(url, anon, {
  auth: { persistSession: false },
});