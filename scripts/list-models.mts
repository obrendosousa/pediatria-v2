import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Testa gemini-embedding-001 com outputDimensionality: 768
const r768 = await ai.models.embedContent({
  model: 'gemini-embedding-001',
  contents: 'teste dimensão',
  config: { outputDimensionality: 768 },
});
const dims768 = r768.embeddings?.[0]?.values?.length;
console.log('Com outputDimensionality:768 →', dims768, 'dimensões');

// Testa sem outputDimensionality (padrão)
const rDefault = await ai.models.embedContent({
  model: 'gemini-embedding-001',
  contents: 'teste dimensão padrão',
});
const dimsDefault = rDefault.embeddings?.[0]?.values?.length;
console.log('Sem outputDimensionality (padrão) →', dimsDefault, 'dimensões');
