/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import { allResearchTools } from './src/ai/clara/tools';
import { getFilteredChatsListTool, getChatCascadeHistoryTool, getAggregatedInsightsTool } from './src/ai/analyst/tools';
import { vaultReadTool, vaultSearchTool, vaultSemanticSearchTool } from './src/ai/vault/tools';

const researcherTools = [
  ...allResearchTools,
  getFilteredChatsListTool,
  getChatCascadeHistoryTool,
  getAggregatedInsightsTool,
  vaultReadTool,
  vaultSearchTool,
  vaultSemanticSearchTool,
];

async function main() {
  console.log(`Total tools: ${researcherTools.length}`);
  console.log(`Tool names: ${researcherTools.map((t: any) => t.name).join(', ')}`);

  // Verificar duplicatas
  const names = researcherTools.map((t: any) => t.name);
  const dupes = names.filter((n: string, i: number) => names.indexOf(n) !== i);
  if (dupes.length > 0) {
    console.error(`DUPLICATE TOOLS FOUND: ${dupes.join(', ')}`);
    return;
  }
  console.log('No duplicate tools found.');

  const model = new ChatGoogleGenerativeAI({
    model: 'gemini-3-flash-preview',
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    temperature: 0,
  }).bindTools(researcherTools);

  try {
    const response = await model.invoke([
      new HumanMessage('Use get_volume_metrics com start_date="2026-03-14" e end_date="2026-03-21" para buscar o volume de chats da semana. Não responda com texto, use a ferramenta.'),
    ]);
    console.log('SUCCESS! tool_calls:', JSON.stringify(response.tool_calls));
    console.log('content:', typeof response.content === 'string' ? response.content.substring(0, 200) : 'non-string');
  } catch (e: unknown) {
    const err = e as Error;
    console.error('ERROR:', err.message);
  }
}

main();
