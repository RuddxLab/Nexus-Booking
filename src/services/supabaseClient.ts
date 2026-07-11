import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  || 'https://axgxsmovzfmaasyzmnqn.supabase.co'

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4Z3hzbW92emZtYWFzeXptbnFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxODIzMzksImV4cCI6MjA5ODc1ODMzOX0.AtJZhagvXvKIlom3oW_b3WKw6GSbhTb2uMgOCNvBevM'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
