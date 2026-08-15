// Public-safe: the anon/publishable key is designed to be embedded in client code.
// Access control is enforced by Supabase Auth + RLS, not by keeping this value secret.
const SUPABASE_URL = "https://gjomyxhuiaajbhqczhgb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jhN32Ey4jZBZV5B9FtGHeQ_fiNpRU0z";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
