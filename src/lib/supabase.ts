import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jqoikdpshyjivouzxqyf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yqGAxR1UyYX4oBwXCD0tLg_9b6Py_M_"; // Replace with your publishable anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
