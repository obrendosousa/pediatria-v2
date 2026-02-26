const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));

const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, sender, message_text, tool_data, created_at, status')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('DB Error:', error);
    return;
  }
  
  console.log(JSON.stringify(data, null, 2));
}

check();
