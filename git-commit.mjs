#!/usr/bin/env node
import git from 'isomorphic-git';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = __dirname;

const IGNORE = new Set(['.git', 'node_modules', '.next', '.vercel', '.pnp', 'coverage', 'out', 'build']);
const IGNORE_PREFIX = ['.env', '.DS_Store'];

function walkDir(dirPath, base = '') {
  const files = [];
  const entries = fs.readdirSync(path.join(dirPath, base), { withFileTypes: true });
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (IGNORE.has(e.name) || IGNORE_PREFIX.some(p => e.name.startsWith(p))) continue;
    if (e.isDirectory()) {
      files.push(...walkDir(dirPath, rel));
    } else {
      files.push(rel);
    }
  }
  return files;
}

async function main() {
  try {
    const isNewRepo = !fs.existsSync(path.join(dir, '.git'));

    // Inicializar se não existir .git
    if (isNewRepo) {
      console.log('📦 Inicializando repositório...');
      await git.init({ fs, dir });
      console.log('✅ Repositório inicializado');
    }

    // Adicionar arquivos
    console.log('📁 Adicionando arquivos...');
    let added = 0;
    if (isNewRepo) {
      const files = walkDir(dir);
      for (const filepath of files) {
        try {
          await git.add({ fs, dir, filepath });
          added++;
        } catch (e) {
          if (!e.message?.includes('already exists')) console.warn('  ', filepath, e.message);
        }
      }
    } else {
      const status = await git.statusMatrix({ fs, dir });
      await Promise.all(
        status.map(([filepath, , worktreeStatus]) =>
          worktreeStatus
            ? git.add({ fs, dir, filepath })
            : git.remove({ fs, dir, filepath })
        )
      );
      added = status.length;
    }
    console.log('✅ Arquivos adicionados');

    // Verificar se há algo para commitar
    const statusAfter = await git.statusMatrix({ fs, dir });
    const hasChanges = statusAfter.some(([, head, work, stage]) => head !== stage || work !== stage);

    if (hasChanges) {
      await git.commit({
        fs,
        dir,
        message: `Atualização do painel clínica - ${new Date().toISOString().split('T')[0]}`,
        author: { name: 'Painel Clínica', email: 'painel@clinica.local' }
      });
      console.log('✅ Commit criado!');
    } else {
      try {
        await git.resolveRef({ fs, dir, ref: 'HEAD' });
        console.log('✅ Nenhuma alteração - projeto já está em dia');
      } catch {
        await git.commit({
          fs,
          dir,
          message: `Atualização do painel clínica - ${new Date().toISOString().split('T')[0]}`,
          author: { name: 'Painel Clínica', email: 'painel@clinica.local' }
        });
        console.log('✅ Commit criado!');
      }
    }

    console.log('\n✅ Pronto! Para enviar ao GitHub, configure o remote e faça push:');
    console.log('   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git');
    console.log('   git push -u origin main');
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

main();
