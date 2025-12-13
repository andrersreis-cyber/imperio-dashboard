import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cxhypcvdijqauaibcgyp.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4aHlwY3ZkaWpxYXVhaWJjZ3lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2Mjg0NzUsImV4cCI6MjA4MTIwNDQ3NX0.3GLQ1hPlee7dMAZiRFeclDEz-Q7G_Uje5eIltp_8VPo'

export const supabase = createClient(supabaseUrl, supabaseKey)
