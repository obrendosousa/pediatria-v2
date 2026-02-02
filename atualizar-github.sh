#!/bin/bash
# Script para preparar e enviar o projeto ao GitHub
# Execute após a instalação do Git (Xcode Command Line Tools)

set -e
cd "$(dirname "$0")"

echo "🔍 Verificando Git..."
if ! git --version &>/dev/null; then
    echo "❌ Git não está funcionando. Aguarde a conclusão da instalação das Xcode Command Line Tools."
    echo "   (Clique em 'Instalar' no diálogo que apareceu e aguarde 1-3 minutos)"
    echo ""
    echo "   Depois execute novamente: ./atualizar-github.sh"
    exit 1
fi

echo "✅ $(git --version) encontrado!"
echo ""

# Inicializar repositório se não existir
if [ ! -d .git ]; then
    echo "📦 Inicializando repositório Git..."
    git init
    echo "✅ Repositório inicializado"
else
    echo "📦 Repositório Git já existe"
fi
echo ""

# Adicionar arquivos
echo "📁 Adicionando arquivos..."
git add .
echo "✅ Arquivos adicionados"
echo ""

# Status
echo "📋 Status:"
git status --short
echo ""

# Commit
echo "💾 Criando commit..."
if git diff --cached --quiet 2>/dev/null; then
    echo "   Nenhuma alteração para commitar (tudo já está em dia)"
else
    git commit -m "Atualização do painel clínica - $(date +%Y-%m-%d)"
    echo "✅ Commit criado!"
fi
echo ""

# Verificar remote
if git remote get-url origin &>/dev/null; then
    echo "🚀 Enviando para o GitHub..."
    git branch -M main 2>/dev/null || true
    git push -u origin main
    echo ""
    echo "✅ Projeto atualizado no GitHub!"
else
    echo "⚠️  Remote do GitHub não configurado."
    echo ""
    echo "Para configurar, execute:"
    echo '  git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git'
    echo ""
    echo "Depois envie com:"
    echo "  git branch -M main"
    echo "  git push -u origin main"
fi
