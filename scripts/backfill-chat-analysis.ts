import { createClient } from "@supabase/supabase-js";
import { chatAnalyzerGraph } from "../src/ai/clara/chatAnalyzerGraph";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
});

async function runBackfill() {
    console.log("🔍 Buscando chats completos para análise em lote...");

    // Buscar os IDs de todos os chats que possuem mensagens ("conversões prováveis")
    const { data: allChats, error: fetchError } = await supabase
        .from("chats")
        .select("id");

    if (fetchError || !allChats) {
        console.error("Erro ao buscar chats:", fetchError);
        process.exit(1);
    }

    // Verificar quais já foram analisados para pular (economizar tokens)
    const { data: alreadyAnalyzed } = await supabase
        .from("chat_insights")
        .select("chat_id");

    const analyzedIds = new Set((alreadyAnalyzed || []).map(r => r.chat_id));
    const chatsToProcess = allChats.map(c => c.id).filter(id => !analyzedIds.has(id));

    console.log(`📊 Total no banco: ${allChats.length}`);
    console.log(`✅ Já analisados: ${analyzedIds.size}`);
    console.log(`⏳ Fila para análise: ${chatsToProcess.length}`);

    if (chatsToProcess.length === 0) {
        console.log("Nenhum chat pendente de análise!");
        process.exit(0);
    }

    console.log("Iniciando processamento (1 a 1 para rate-limit)...");

    let success = 0;
    let failed = 0;

    for (let i = 0; i < chatsToProcess.length; i++) {
        const chatId = chatsToProcess[i];
        console.log(`\n[${i + 1}/${chatsToProcess.length}] Processando chat_id: ${chatId}...`);

        try {
            await chatAnalyzerGraph.invoke({ chat_id: chatId });
            console.log(`✅ Concluído chat ${chatId}.`);
            success++;
        } catch (e: any) {
            console.error(`❌ Erro no chat ${chatId}:`, e.message);
            failed++;
        }
    }

    console.log(`\n🎉 Análise em lote concluída! Sucesso: ${success} | Erros: ${failed}`);
    process.exit(0);
}

runBackfill();
