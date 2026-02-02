#!/usr/bin/env tsx

/**
 * Script para importar dados de referência das curvas de crescimento OMS/CDC
 * do repositório pygrowup para o banco de dados Supabase
 * 
 * Uso: npm run seed:growth
 */

// Carregar variáveis de ambiente do .env.local
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carregar .env.local (prioridade sobre .env)
const envPath = path.join(process.cwd(), '.env.local');
const envResult = dotenv.config({ path: envPath });
// Também tentar .env como fallback
dotenv.config();

import * as fs from 'fs/promises';
import { createClient } from '@supabase/supabase-js';
import { downloadPyGrowupData, listJsonFiles } from './utils/downloadPyGrowupData';
import { parseGrowthFileName, validateMetadata } from './utils/parseGrowthFile';
import { mapJsonRowToDb, validateRow, GrowthStandardRow } from './utils/mapJsonToDb';

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  console.error('   NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias');
  console.error(`   Arquivo .env.local procurado em: ${envPath}`);
  if (envResult.error) {
    console.error(`   Erro ao carregar .env.local: ${envResult.error.message}`);
  } else {
    console.error('   Arquivo .env.local carregado, mas variáveis não encontradas');
    console.error(`   NEXT_PUBLIC_SUPABASE_URL existe: ${!!process.env.NEXT_PUBLIC_SUPABASE_URL}`);
    console.error(`   SUPABASE_SERVICE_ROLE_KEY existe: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
  }
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Estatísticas
interface ImportStats {
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  totalRows: number;
  insertedRows: number;
  skippedRows: number;
  errors: Array<{ file: string; error: string }>;
}

/**
 * Função principal de importação
 */
async function main() {
  console.log('🚀 Iniciando importação de dados de crescimento OMS/CDC\n');

  const stats: ImportStats = {
    totalFiles: 0,
    processedFiles: 0,
    failedFiles: 0,
    totalRows: 0,
    insertedRows: 0,
    skippedRows: 0,
    errors: [],
  };

  try {
    // 1. Baixar dados do repositório pygrowup
    const dataDir = await downloadPyGrowupData();

    // 2. Listar arquivos JSON
    const jsonFiles = await listJsonFiles(dataDir);
    stats.totalFiles = jsonFiles.length;

    if (jsonFiles.length === 0) {
      console.error('❌ Nenhum arquivo JSON encontrado');
      process.exit(1);
    }

    console.log(`\n📊 Encontrados ${jsonFiles.length} arquivos para processar\n`);

    // 3. Processar cada arquivo
    for (const filePath of jsonFiles) {
      await processFile(filePath, stats);
    }

    // 4. Relatório final
    printReport(stats);

  } catch (error: any) {
    console.error('❌ Erro fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Processa um arquivo JSON individual
 */
async function processFile(filePath: string, stats: ImportStats): Promise<void> {
  const filename = path.basename(filePath);
  console.log(`📄 Processando: ${filename}`);

  try {
    // 1. Parsear nome do arquivo
    const metadata = parseGrowthFileName(filePath);
    if (!metadata || !validateMetadata(metadata)) {
      stats.failedFiles++;
      stats.errors.push({
        file: filename,
        error: 'Metadados inválidos ou não identificados',
      });
      console.log(`  ⚠️  Metadados inválidos, pulando...\n`);
      return;
    }

    console.log(`  ✓ Tipo: ${metadata.type}, Gênero: ${metadata.gender}, Fonte: ${metadata.source}`);

    // 2. Ler e parsear JSON
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const jsonData: any[] = JSON.parse(fileContent);

    if (!Array.isArray(jsonData) || jsonData.length === 0) {
      stats.failedFiles++;
      stats.errors.push({
        file: filename,
        error: 'JSON inválido ou vazio',
      });
      console.log(`  ⚠️  JSON inválido, pulando...\n`);
      return;
    }

    console.log(`  ✓ ${jsonData.length} linhas encontradas`);

    // 3. Mapear e validar linhas
    const rowsToInsert: GrowthStandardRow[] = [];
    let skipped = 0;

    for (const jsonRow of jsonData) {
      const mappedRow = mapJsonRowToDb(jsonRow, metadata);
      const validation = validateRow(mappedRow);

      if (validation.valid) {
        rowsToInsert.push(mappedRow);
      } else {
        skipped++;
        if (skipped <= 3) {
          console.log(`  ⚠️  Linha inválida: ${validation.errors.join(', ')}`);
        }
      }
    }

    stats.totalRows += jsonData.length;
    stats.skippedRows += skipped;

    if (rowsToInsert.length === 0) {
      stats.failedFiles++;
      stats.errors.push({
        file: filename,
        error: 'Nenhuma linha válida após validação',
      });
      console.log(`  ⚠️  Nenhuma linha válida, pulando...\n`);
      return;
    }

    console.log(`  ✓ ${rowsToInsert.length} linhas válidas para inserir`);

    // 4. Inserir em lotes no Supabase
    const batchSize = 200;
    let inserted = 0;

    for (let i = 0; i < rowsToInsert.length; i += batchSize) {
      const batch = rowsToInsert.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('growth_standards')
        .upsert(batch, {
          onConflict: 'source,type,gender,age_months,x_value',
        })
        .select();

      if (error) {
        throw new Error(`Erro ao inserir lote: ${error.message}`);
      }

      inserted += data?.length || 0;
      process.stdout.write(`  📤 Lote ${Math.floor(i / batchSize) + 1}: ${data?.length || 0} linhas inseridas\r`);
    }

    stats.insertedRows += inserted;
    stats.processedFiles++;
    console.log(`  ✅ ${inserted} linhas inseridas com sucesso\n`);

  } catch (error: any) {
    stats.failedFiles++;
    stats.errors.push({
      file: filename,
      error: error.message || 'Erro desconhecido',
    });
    console.log(`  ❌ Erro: ${error.message}\n`);
  }
}

/**
 * Imprime relatório final
 */
function printReport(stats: ImportStats): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 RELATÓRIO DE IMPORTAÇÃO');
  console.log('='.repeat(60));
  console.log(`Total de arquivos:        ${stats.totalFiles}`);
  console.log(`Arquivos processados:     ${stats.processedFiles}`);
  console.log(`Arquivos com erro:        ${stats.failedFiles}`);
  console.log(`Total de linhas lidas:    ${stats.totalRows}`);
  console.log(`Linhas inseridas:         ${stats.insertedRows}`);
  console.log(`Linhas ignoradas:         ${stats.skippedRows}`);
  console.log('='.repeat(60));

  if (stats.errors.length > 0) {
    console.log('\n⚠️  ERROS ENCONTRADOS:');
    stats.errors.forEach(({ file, error }) => {
      console.log(`  - ${file}: ${error}`);
    });
  }

  if (stats.insertedRows > 0) {
    console.log('\n✅ Importação concluída com sucesso!');
  } else {
    console.log('\n⚠️  Nenhuma linha foi inserida. Verifique os erros acima.');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

export { main };
