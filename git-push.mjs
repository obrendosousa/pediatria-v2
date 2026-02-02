#!/usr/bin/env node
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = __dirname;

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('❌ Para enviar ao GitHub, defina um Personal Access Token:');
    console.error('   export GITHUB_TOKEN=seu_token_aqui');
    console.error('');
    console.error('   Crie em: https://github.com/settings/tokens');
    console.error('   (marque o escopo "repo")');
    process.exit(1);
  }

  try {
    console.log('🚀 Enviando para GitHub...');
    await git.push({
      fs,
      http,
      dir,
      remote: 'origin',
      ref: 'master',
      onAuth: () => ({
        username: 'obrendosousa',
        password: token
      })
    });
    console.log('✅ Projeto atualizado no GitHub!');
  } catch (err) {
    if (err.message?.includes('401') || err.message?.includes('Authentication')) {
      console.error('❌ Autenticação falhou. Verifique se o token está correto.');
    } else {
      console.error('❌ Erro:', err.message);
    }
    process.exit(1);
  }
}

main();
