# Configuração de Variáveis de Ambiente

## Variável Necessária para IA

Para usar a funcionalidade de agendamento com IA, você precisa adicionar a chave da API OpenAI:

### Adicionar OPENAI_API_KEY

1. Abra o arquivo `.env.local` na raiz do projeto
2. Adicione a seguinte linha:

```bash
OPENAI_API_KEY=sua-chave-api-openai-aqui
```

### Como obter a chave da API OpenAI

1. Acesse: https://platform.openai.com/api-keys
2. Faça login na sua conta OpenAI
3. Clique em "Create new secret key"
4. Copie a chave gerada
5. Cole no arquivo `.env.local`

### Exemplo completo do .env.local

```bash
NEXT_PUBLIC_SUPABASE_URL=https://juctfolupehtaoehjkwl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role

# Evolution API
EVOLUTION_API_URL="https://evolution-evolution-api.rozhd7.easypanel.host/"
EVOLUTION_API_KEY="sua-chave-evolution"
EVOLUTION_INSTANCE="Pediatria Alianca"

# OpenAI API (NECESSÁRIO para agendamento com IA)
OPENAI_API_KEY=sk-proj-sua-chave-openai-aqui

# Worker de agendamentos/disparos (produção)
DATABASE_URL=postgresql://...
LANGGRAPH_CHECKPOINT_POSTGRES_URI=postgresql://...
LANGGRAPH_CHECKPOINTER_MODE=auto
WORKER_DRY_RUN=false
WORKER_PORT=4040
WORKER_POLL_INTERVAL_MS=5000
WORKER_SCHEDULER_INTERVAL_MS=60000
```

### Importante

- **Nunca** commite o arquivo `.env.local` no Git (ele já está no .gitignore)
- Após adicionar a variável, **reinicie o servidor de desenvolvimento** (`npm run dev`)
- A funcionalidade de IA só funcionará após configurar esta variável

### Sem a chave configurada

Se a chave não estiver configurada, você verá uma mensagem de erro amigável ao tentar usar o agendamento com IA, e poderá optar por abrir o formulário de agendamento manualmente.
