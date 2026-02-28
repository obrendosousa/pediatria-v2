import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function run() {
  // Total de chat_insights
  const { count: insightCount } = await supabase.from("chat_insights").select("*", { count: "exact", head: true });
  console.log("Total de registros em chat_insights:", insightCount);

  // Amostras recentes com updated_at e created_at
  const { data: samples, error } = await supabase.from("chat_insights").select("id, chat_id, nota_atendimento, created_at, updated_at").order("created_at", { ascending: false }).limit(5);
  if (error) console.error("Erro:", error.message);
  else console.log("\n5 mais recentes:\n", JSON.stringify(samples, null, 2));

  // Total de chats
  const { count: chatCount } = await supabase.from("chats").select("*", { count: "exact", head: true });
  console.log("\nTotal de chats:", chatCount);

  // Últimos 3 chats com last_interaction_at
  const { data: recentChats } = await supabase.from("chats").select("id, contact_name, stage, last_interaction_at").order("last_interaction_at", { ascending: false }).limit(3);
  console.log("\nÚltimos 3 chats:\n", JSON.stringify(recentChats, null, 2));
}
run().catch(console.error);
