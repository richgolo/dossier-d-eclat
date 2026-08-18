// Fill these in from Supabase → Project Settings → API, after running
// supabase-schema.sql in the SQL Editor. The publishable key is meant to be
// public/client-side — it's what the Row Level Security policies in
// supabase-schema.sql are for.
const SUPABASE_URL = "https://xhlffjhpwhmeukutdchl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jM8Hc-WTJUVCKTLEzFci7g_1ZZYynY-";

// Stays null until the placeholders above are filled in, so pages that
// depend on it (products.js, the reviews section) can show a friendly
// message instead of breaking.
let supabaseClient = null;
try {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.warn('Supabase not configured yet — fill in supabase-config.js', e);
}
