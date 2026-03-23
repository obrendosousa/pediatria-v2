#!/bin/bash

echo "🚀 Configurando o projeto Painel Clínica..."
echo ""

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado!"
    echo ""
    echo "Por favor, instale o Node.js primeiro:"
    echo "  Opção 1: Baixe em https://nodejs.org/"
    echo "  Opção 2: Use Homebrew: brew install node"
    echo "  Opção 3: Use nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    echo ""
    exit 1
fi

# Verificar versão do Node.js
NODE_VERSION=$(node --version)
echo "✅ Node.js encontrado: $NODE_VERSION"

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não está instalado!"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "✅ npm encontrado: $NPM_VERSION"
echo ""

# Verificar se .env.local existe
if [ ! -f .env.local ]; then
    echo "⚠️  Arquivo .env.local não encontrado. Criando a partir de env.local..."
    if [ -f env.local ]; then
        cp env.local .env.local
        echo "✅ Arquivo .env.local criado!"
    else
        echo "❌ Arquivo env.local não encontrado. Por favor, crie o arquivo .env.local manualmente."
        exit 1
    fi
else
    echo "✅ Arquivo .env.local já existe"
fi

echo ""
echo "📦 Instalando dependências..."
echo "⚠️  Usando --legacy-peer-deps para resolver conflitos de dependências..."
npm install --legacy-peer-deps

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Instalação concluída com sucesso!"
    echo ""
    echo "Para iniciar o servidor de desenvolvimento, execute:"
    echo "  npm run dev"
    echo ""
else
    echo ""
    echo "❌ Erro ao instalar dependências. Verifique os erros acima."
    exit 1
fi
