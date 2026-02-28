import { gerarRelatorioQualidadeTool } from "./src/ai/clara/tools";
import { getAggregatedInsightsTool } from "./src/ai/analyst/tools";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function run() {
  console.log("Teste: gerarRelatorioQualidadeTool");
  const res1 = await gerarRelatorioQualidadeTool.invoke({ dias_retroativos: 30 });
  console.log(res1);

  console.log("\nTeste: getAggregatedInsightsTool");
  const d = new Date();
  const res2 = await getAggregatedInsightsTool.invoke({ start_date: new Date(d.setDate(d.getDate() - 30)).toISOString(), end_date: new Date().toISOString() });
  console.log(res2);
}
run();
