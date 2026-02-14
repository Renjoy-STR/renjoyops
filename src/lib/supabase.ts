import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jqoikdpshyjivouzxqyf.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE'; // Replace with your publishable anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
