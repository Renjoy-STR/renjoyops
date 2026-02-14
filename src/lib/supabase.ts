import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jqoikdpshyjivouzxqyf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impxb2lrZHBzaHlqaXZvdXp4cXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNTQ0MjIsImV4cCI6MjA4NTgzMDQyMn0.D0cnTKJnYAscpBBHQlOvZgTm7jphZACHiStbX8ZkNw0"; // Replace with your publishable anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
