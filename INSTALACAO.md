# 🚀 Guia de Instalação - Painel Clínica

## Pré-requisitos

Antes de começar, você precisa ter o **Node.js** instalado na sua máquina.

### Instalando o Node.js

**Opção 1: Download direto (Recomendado para iniciantes)**
- Acesse: https://nodejs.org/
- Baixe a versão LTS (Long Term Support)
- Execute o instalador e siga as instruções

**Opção 2: Via Homebrew (macOS)**
```bash
brew install node
```

**Opção 3: Via NVM (Node Version Manager)**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
nvm use --lts
```

### Verificar instalação

Após instalar, verifique se está funcionando:
```bash
node --version
npm --version
```

## Instalação do Projeto

### Método 1: Script Automático (Recomendado)

Execute o script de setup:
```bash
./setup.sh
```

### Método 2: Instalação Manual

1. **Instalar dependências:**
```bash
npm install --legacy-peer-deps
```

**Nota:** Usamos `--legacy-peer-deps` porque há um conflito de versões entre `react-zxing` (que suporta React 16-18) e o React 19 usado no projeto. Esta flag resolve o conflito permitindo a instalação.

2. **Verificar arquivo de ambiente:**
   - O arquivo `.env.local` já foi criado automaticamente
   - Se necessário, você pode editá-lo com suas credenciais

3. **Iniciar o servidor de desenvolvimento:**
```bash
npm run dev
```

4. **Acessar a aplicação:**
   - Abra seu navegador em: http://localhost:3000

## 📝 Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Cria uma build de produção
- `npm run start` - Inicia o servidor de produção
- `npm run lint` - Executa o linter
- `npm run seed:growth` - Popula dados de crescimento (requer configuração adicional)

## ⚠️ Problemas Comuns

### Erro: "command not found: node"
- **Solução:** Instale o Node.js seguindo as instruções acima

### Erro: "Faltam as variáveis de ambiente"
- **Solução:** Verifique se o arquivo `.env.local` existe e contém as variáveis necessárias

### Erro ao instalar dependências
- **Solução:** Tente limpar o cache e reinstalar:
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --legacy-peer-deps
```

### Erro: "ERESOLVE could not resolve" (conflito de peer dependencies)
- **Solução:** Este é um conflito conhecido com `react-zxing`. Use:
```bash
npm install --legacy-peer-deps
```

## 🎯 Próximos Passos

Após a instalação bem-sucedida:
1. Execute `npm run dev`
2. Acesse http://localhost:3000
3. Configure o banco de dados Supabase (se necessário)
4. Consulte o `README_IMPLEMENTACAO.md` para mais detalhes sobre funcionalidades
