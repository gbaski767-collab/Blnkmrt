// ============================================================================
// Supabase Client
// ----------------------------------------------------------------------------
// 1. Create a project at https://supabase.com
// 2. Go to Project Settings → API and copy the "Project URL" and "anon public"
//    key into the two constants below.
// 3. Run supabase/schema.sql once in the SQL Editor to create every table,
//    policy and function this app needs.
//
// This file is loaded on every page AFTER the Supabase CDN script tag:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="js/supabaseClient.js"></script>
// ============================================================================

const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';

// `persistSession` keeps the user logged in across page loads by storing the
// session in localStorage — necessary here because this is a classic
// multi-page site (not a single-page app), so every page navigation is a
// full reload that needs to rehydrate the session from somewhere.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
