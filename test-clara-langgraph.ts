import { claraGraph } from "./src/ai/clara/graph";
import { HumanMessage } from "@langchain/core/messages";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const TEST_CHAT_ID = 999999;
const TEST_THREAD_ID = String(TEST_CHAT_ID);

async function runTest() {
    console.log("🚀 [Test] Iniciando Teste do LangGraph Checkpointer...");

    console.log("\\n1️⃣ Primeira Mensagem: 'Oi Clara, meu nome é TesteVirtual.'");
    const res1 = await claraGraph.invoke(
        {
            messages: [new HumanMessage("Oi Clara, meu nome é TesteVirtual e eu amo a cor azul.")],
            chat_id: TEST_CHAT_ID
        },
        { configurable: { thread_id: TEST_THREAD_ID } }
    );

    const msg1 = res1.messages[res1.messages.length - 1].content;
    console.log(`🤖 Clara: ${msg1}`);

    console.log("\\n2️⃣ Segunda Mensagem: Qual é o meu nome e minha cor favorita?");
    const res2 = await claraGraph.invoke(
        {
            messages: [new HumanMessage("Qual é o meu nome e qual a minha cor favorita?")],
            chat_id: TEST_CHAT_ID
        },
        { configurable: { thread_id: TEST_THREAD_ID } }
    );

    const msg2 = res2.messages[res2.messages.length - 1].content;
    console.log(`🤖 Clara: ${msg2}`);

    if (String(msg2).includes("TesteVirtual") && String(msg2).toLowerCase().includes("azul")) {
        console.log("\\n✅ SUCESSO! O PostgresSaver está persistindo o estado entre invocações.");
    } else {
        console.log("\\n❌ FALHA! A Clara perdeu o contexto. Verifique o reducer e o checkpointer.");
    }

    process.exit(0);
}

runTest();
