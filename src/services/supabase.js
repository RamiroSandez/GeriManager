import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mfbltxyoyqsfdonghohu.supabase.co'
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mYmx0eHlveXFzZmRvbmdob2h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTQxMjgsImV4cCI6MjA4ODgzMDEyOH0.uaRgnFcbNjQy2HIDaykWM-HkKcIn7UP4NffSMy7E1vc"

export const supabase = createClient(supabaseUrl, supabaseKey)