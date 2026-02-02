// Utilitário para baixar arquivos JSON do repositório pygrowup do GitHub

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const PYGROWUP_REPO_URL = 'https://github.com/ewheeler/pygrowup.git';
const DATA_DIR = path.join(process.cwd(), 'data', 'standards');
const TEMP_CLONE_DIR = path.join(process.cwd(), 'temp_pygrowup');

/**
 * Baixa ou clona o repositório pygrowup do GitHub
 * @returns Caminho para a pasta de dados JSON
 */
export async function downloadPyGrowupData(): Promise<string> {
  console.log('📥 Baixando dados do repositório pygrowup...');

  try {
    // Criar diretório de destino se não existir
    await fs.mkdir(DATA_DIR, { recursive: true });

    // Verificar se já temos os dados
    const files = await fs.readdir(DATA_DIR).catch(() => []);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    if (jsonFiles.length > 0) {
      console.log(`✅ Dados já existem em ${DATA_DIR} (${jsonFiles.length} arquivos JSON)`);
      console.log('💡 Para baixar novamente, delete a pasta data/standards');
      return DATA_DIR;
    }

    // Verificar se há uma pasta local com dados (para uso manual)
    const localDataPaths = [
      path.join(process.cwd(), 'data', 'pygrowup'),
      path.join(process.cwd(), 'pygrowup', 'pygrowup', 'tables'), // Se clonou manualmente
      path.join(process.cwd(), 'pygrowup', 'tables'), // Se clonou manualmente
    ];

    for (const localDataPath of localDataPaths) {
      try {
        const localFiles = await fs.readdir(localDataPath);
        const localJsonFiles = localFiles.filter(f => f.endsWith('.json'));
        if (localJsonFiles.length > 0) {
          console.log(`📁 Usando dados locais de ${localDataPath} (${localJsonFiles.length} arquivos)`);
          await copyJsonFiles(localDataPath, DATA_DIR);
          return DATA_DIR;
        }
      } catch {
        // Pasta local não existe, continuar procurando
      }
    }

    // Limpar diretório temporário se existir
    try {
      await fs.rm(TEMP_CLONE_DIR, { recursive: true, force: true });
    } catch {
      // Ignorar erro se não existir
    }

    // Clonar repositório temporariamente
    console.log('🔄 Clonando repositório pygrowup...');
    await execAsync(`git clone ${PYGROWUP_REPO_URL} ${TEMP_CLONE_DIR}`, {
      cwd: process.cwd(),
    });

    // Localizar pasta de dados - tentar vários caminhos possíveis
    // O pygrowup armazena dados em pygrowup/tables/ (arquivos .txt que podem ser convertidos)
    const possiblePaths = [
      path.join(TEMP_CLONE_DIR, 'pygrowup', 'tables'), // Pasta tables (formato .txt)
      path.join(TEMP_CLONE_DIR, 'pygrowup', 'pygrowup', 'tables'), // Estrutura aninhada
      path.join(TEMP_CLONE_DIR, 'pygrowup', 'pygrowup', 'data'), // Estrutura aninhada
      path.join(TEMP_CLONE_DIR, 'pygrowup', 'data'), // Estrutura padrão
      path.join(TEMP_CLONE_DIR, 'data'), // Estrutura alternativa
      path.join(TEMP_CLONE_DIR, 'pygrowup', 'data', 'json'), // Com subpasta json
    ];

    let dataSourcePath: string | null = null;
    
    // Procurar pasta de dados (JSON ou TXT)
    for (const testPath of possiblePaths) {
      try {
        await fs.access(testPath);
        const files = await fs.readdir(testPath);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        const txtFiles = files.filter(f => f.endsWith('.txt') && f.includes('zscore'));
        
        if (jsonFiles.length > 0) {
          dataSourcePath = testPath;
          console.log(`📁 Dados JSON encontrados em: ${testPath} (${jsonFiles.length} arquivos)`);
          break;
        } else if (txtFiles.length > 0) {
          // Se encontrou arquivos .txt, tentar usar diretamente do repositório clonado manualmente
          console.log(`📁 Dados TXT encontrados em: ${testPath} (${txtFiles.length} arquivos)`);
          console.log('⚠️  Arquivos .txt precisam ser convertidos para JSON');
          console.log('💡 Opção 1: Execute manualmente: pip install pygrowup');
          console.log('💡 Opção 2: Coloque arquivos JSON já convertidos em data/pygrowup/');
          console.log('💡 Opção 3: O script tentará usar o repositório clonado manualmente');
          
          // Tentar usar o repositório clonado manualmente se existir
          const manualRepoPath = path.join(process.cwd(), 'pygrowup', 'pygrowup', 'tables');
          try {
            await fs.access(manualRepoPath);
            console.log(`📁 Tentando usar repositório manual em: ${manualRepoPath}`);
            // Continuar para tentar converter ou usar
          } catch {
            throw new Error('Arquivos .txt encontrados, mas conversão para JSON não está implementada automaticamente. Coloque arquivos JSON em data/pygrowup/ ou converta manualmente.');
          }
        }
      } catch (error: any) {
        if (error.message && error.message.includes('conversão')) {
          throw error;
        }
        // Continuar procurando
      }
    }

    if (!dataSourcePath) {
      // Listar estrutura do repositório para debug
      console.log('🔍 Estrutura do repositório clonado:');
      try {
        const rootFiles = await fs.readdir(TEMP_CLONE_DIR);
        console.log('  Raiz:', rootFiles.join(', '));
        
        if (rootFiles.includes('pygrowup')) {
          const pygrowupFiles = await fs.readdir(path.join(TEMP_CLONE_DIR, 'pygrowup'));
          console.log('  pygrowup/', pygrowupFiles.join(', '));
          
          // Verificar se há subpasta pygrowup
          if (pygrowupFiles.includes('pygrowup')) {
            const nestedFiles = await fs.readdir(path.join(TEMP_CLONE_DIR, 'pygrowup', 'pygrowup'));
            console.log('  pygrowup/pygrowup/', nestedFiles.join(', '));
          }
        }
      } catch (e) {
        console.error('  Erro ao listar estrutura:', e);
      }
      
      throw new Error(`Pasta de dados não encontrada. Tentamos: ${possiblePaths.join(', ')}`);
    }

    // Copiar apenas arquivos JSON
    await copyJsonFiles(dataSourcePath!, DATA_DIR);

    // Limpar repositório temporário
    await cleanup();

    console.log(`✅ Dados baixados com sucesso para ${DATA_DIR}`);
    return DATA_DIR;
  } catch (error: any) {
    console.error('❌ Erro ao baixar dados:', error.message);
    
    // Tentar limpar em caso de erro
    await cleanup().catch(() => {});
    
    throw error;
  }
}

/**
 * Copia apenas arquivos JSON da pasta de origem para destino
 */
async function copyJsonFiles(sourceDir: string, destDir: string): Promise<void> {
  const files = await fs.readdir(sourceDir);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  console.log(`📋 Encontrados ${jsonFiles.length} arquivos JSON`);

  for (const file of jsonFiles) {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);
    
    await fs.copyFile(sourcePath, destPath);
    console.log(`  ✓ Copiado: ${file}`);
  }
}

/**
 * Remove o diretório temporário do clone
 */
async function cleanup(): Promise<void> {
  try {
    await fs.rm(TEMP_CLONE_DIR, { recursive: true, force: true });
    console.log('🧹 Limpeza concluída');
  } catch (error) {
    console.warn('⚠️  Aviso: Não foi possível remover diretório temporário:', error);
  }
}

/**
 * Lista todos os arquivos JSON na pasta de dados
 */
export async function listJsonFiles(dataDir: string = DATA_DIR): Promise<string[]> {
  try {
    const files = await fs.readdir(dataDir);
    return files.filter(f => f.endsWith('.json')).map(f => path.join(dataDir, f));
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
    return [];
  }
}
