
// Supabase Configuration
// This file contains the PUBLIC Anonymous Key for Supabase.
// It is safe to expose this key in client-side code because it is restricted by Row Level Security (RLS).
// However, do NOT expose the 'service_role' key here.

const SUPABASE_CONFIG = {
    url: 'https://zvhwibdprnbabhucqixm.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2aHdpYmRwcm5iYWJodWNxaXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTgzMjUsImV4cCI6MjA4NjQ3NDMyNX0.pz4uJl3aFxKBnSH7Vc43MViI7SocSNr3slT_M9w_XqM'
};

export default SUPABASE_CONFIG;
