import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: d1 } = await supabase.from('exam_requests').select('id, request_type, medical_record_id').order('created_at', { ascending: false }).limit(5);
  console.log("Exam Requests:");
  console.log(d1);

  const { data: d2 } = await supabase.from('prescriptions').select('id, medical_record_id').order('created_at', { ascending: false }).limit(5);
  console.log("Prescriptions:");
  console.log(d2);

  const { data: d3 } = await supabase.from('medical_documents').select('id, type, medical_record_id').order('created_at', { ascending: false }).limit(5);
  console.log("Documents:");
  console.log(d3);
}

check();
