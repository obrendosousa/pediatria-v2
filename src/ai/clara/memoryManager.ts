import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { BaseMessage } from "@langchain/core/messages";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente Supabase dedicado para banco de dados
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
});

// Inicializamos o modelo de Embeddings (usando Google Gen AI)
const embeddings = new GoogleGenerativeAIEmbeddings({
    modelName: "text-embedding-004", // Ou o modelo que preferir
});

/**
 * Interface para a Memória Semântica
 */
export interface SemanticMemoryRecord {
    id?: string;
    patient_phone: string;
    content: string;
    category?: string;
    source_role?: string;
}

/**
 * Salva um fato ou perfil consolidado no banco vetorial.
 */
export async function saveSemanticMemory(record: SemanticMemoryRecord) {
    try {
        // 1. Gerar Embedding do Conteúdo
        const vector = await embeddings.embedQuery(record.content);

        // 2. Salvar no Supabase (usando rpc customizado ou diretamente na tabela)
        // Se a extensão pgvector estiver ativa, precisaremos inserir usando query crua
        // ou passando o vetor formatado como string, pois o Supabase Client suporta arrays
        const formattedVector = `[${vector.join(",")}]`;

        const { error } = await supabase.from("semantic_memory").insert({
            patient_phone: record.patient_phone,
            content: record.content,
            category: record.category || "geral",
            source_role: record.source_role || "system",
            embedding: formattedVector as any,
        });

        if (error) {
            console.error("Erro ao salvar memória semântica:", error);
        }
    } catch (error) {
        console.error("Exceção em saveSemanticMemory:", error);
    }
}

/**
 * Recupera memórias baseada em similaridade (Vector Search).
 * Isso simula a recuperação episódica / semântica usando pgvector no Supabase.
 */
export async function searchSemanticMemory(patientPhone: string, query: string, limit = 5): Promise<string[]> {
    try {
        const queryVector = await embeddings.embedQuery(query);
        const formattedVector = `[${queryVector.join(",")}]`;

        // Para fazer a busca por similaridade (cosine), precisamos invocar uma RPC.
        // Como criamos a tabela manualmente, talvez não tenhamos a RPC "match_semantic_memory" ainda.
        // Opcional: Aqui usaríamos uma Function no Supabase. Para manter simples agora e já funcionar caso
        // tenhamos só Prisma/PG cru, ou RPC. Aqui implemento via RPC padrão match_documents.

        // Se a RPC 'match_semantic_memory' não existir, vai falhar! 
        // Por enquanto, faremos select comum se não tiver vetor.
        // Você vai precisar adicionar a seguinte SQL no Supabase depois:
        /*
          CREATE OR REPLACE FUNCTION match_semantic_memory (
            query_embedding vector(768),
            match_phone text,
            match_count int DEFAULT 5
          ) RETURNS TABLE (
            id uuid,
            patient_phone text,
            content text,
            similarity float
          )
          LANGUAGE plpgsql
          AS $$
          BEGIN
            RETURN QUERY
            SELECT
              semantic_memory.id,
              semantic_memory.patient_phone,
              semantic_memory.content,
              1 - (semantic_memory.embedding <=> query_embedding) AS similarity
            FROM semantic_memory
            WHERE semantic_memory.patient_phone = match_phone
            ORDER BY semantic_memory.embedding <=> query_embedding
            LIMIT match_count;
          END;
          $$;
        */

        const { data, error } = await supabase.rpc("match_semantic_memory", {
            query_embedding: formattedVector,
            match_phone: patientPhone,
            match_count: limit,
        });

        if (error) {
            console.warn("RPC match_semantic_memory falhou. Talvez não criada. Fallback normal.");
            // Fallback pra ler do paciente inteiro (apenas as top recents)
            const { data: fallbackData } = await supabase
                .from("semantic_memory")
                .select("content")
                .eq("patient_phone", patientPhone)
                .order("created_at", { ascending: false })
                .limit(limit);

            return (fallbackData || []).map(row => row.content);
        }

        return (data || []).map((row: any) => row.content);
    } catch (error) {
        console.error("Exceção em searchSemanticMemory:", error);
        return [];
    }
}
