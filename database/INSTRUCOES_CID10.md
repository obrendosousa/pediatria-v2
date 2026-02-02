# Instruções Rápidas - Implementação CID-10

## ⚡ Execução Rápida no Supabase

Siga estes passos para habilitar a busca CID-10 completa:

### 1. Executar Scripts SQL no Supabase

Acesse o **SQL Editor** do seu projeto Supabase e execute os scripts na seguinte ordem:

#### Passo 1: Ativar Extensão pg_trgm
```sql
-- Copie e execute o conteúdo de:
database/enable_pg_trgm.sql
```
**Resultado esperado:** Extensão `pg_trgm` criada com sucesso.

#### Passo 2: Criar Tabela cid_sub_categoria
```sql
-- Copie e execute o conteúdo de:
database/cid10_sub_categoria_table.sql
```
**Resultado esperado:** Tabela `cid_sub_categoria` criada com índices GIN.

#### Passo 3: Criar Função RPC search_cid10
```sql
-- Copie e execute o conteúdo de:
database/rpc_search_cid10.sql
```
**Resultado esperado:** Função `search_cid10` criada com sucesso.

### 2. Importar Dados do CID-10

#### Opção A: Via SQL Editor do Supabase (Recomendado)
1. Abra o arquivo `subcategoria.sql` do repositório CID10-SQL
2. Copie TODO o conteúdo (todos os INSERTs)
3. Cole no SQL Editor do Supabase
4. Execute (pode levar alguns minutos - são ~8.000 registros)

#### Opção B: Via CLI (Alternativo)
```bash
# Execute via psql
psql $DATABASE_URL -f c:/Users/brend/Downloads/CID10-SQL-master/CID10-SQL-master/subcategoria.sql
```

**Resultado esperado:** ~8.351 registros inseridos na tabela `cid_sub_categoria`.

### 3. Validar Instalação

Execute estas queries no SQL Editor para validar:

```sql
-- Verificar se a extensão está ativa
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';

-- Contar registros importados
SELECT COUNT(*) FROM cid_sub_categoria;

-- Testar função RPC
SELECT * FROM search_cid10('gastroenterite');
SELECT * FROM search_cid10('A00');
SELECT * FROM search_cid10('K58');
```

**Resultados esperados:**
- ✅ Extensão `pg_trgm` encontrada
- ✅ ~8.351 registros na tabela
- ✅ Função RPC retorna resultados formatados (ex: `A00.0`, `A00.1`)

### 4. Testar no Frontend

Após executar os scripts, teste no componente de diagnóstico:

1. Acesse a tela de atendimento médico
2. Clique no campo "Diagnóstico"
3. Digite alguns termos:
   - `gastroenterite` → deve encontrar resultados
   - `A00` → deve mostrar códigos de Cólera
   - `K58` → deve mostrar códigos de Síndrome do cólon irritável
   - `diabetes` → deve encontrar códigos de diabetes

**Recursos ativos:**
- ✅ Busca fuzzy (tolerante a erros de digitação)
- ✅ Busca por código ou descrição
- ✅ Debounce de 300ms (espera parar de digitar)
- ✅ Formatação automática do código (A000 → A00.0)
- ✅ Ordenação por relevância

## 🐛 Troubleshooting

### Erro: "function similarity does not exist"
**Solução:** A extensão `pg_trgm` não foi criada. Execute novamente `enable_pg_trgm.sql`.

### Erro: "relation cid_sub_categoria does not exist"
**Solução:** A tabela não foi criada. Execute novamente `cid10_sub_categoria_table.sql`.

### Erro: "function search_cid10 does not exist"
**Solução:** A função RPC não foi criada. Execute novamente `rpc_search_cid10.sql`.

### Nenhum resultado na busca
**Solução:** Verifique se os dados foram importados:
```sql
SELECT COUNT(*) FROM cid_sub_categoria;
```
Se retornar 0, execute o import do arquivo `subcategoria.sql`.

### Busca lenta
**Solução:** Verifique se os índices foram criados:
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'cid_sub_categoria';
```
Deve retornar 3 índices (btree no id, gin no id, gin na descricao).

## ✅ Checklist Final

- [ ] Extensão `pg_trgm` criada
- [ ] Tabela `cid_sub_categoria` criada com índices
- [ ] Função RPC `search_cid10` criada
- [ ] Dados importados (~8.351 registros)
- [ ] Testes básicos funcionando
- [ ] Componente `DiagnosisSelect` buscando corretamente

## 📞 Suporte

Se ainda tiver problemas:
1. Verifique os logs de erro no SQL Editor do Supabase
2. Confirme que está executando no projeto correto
3. Verifique permissões do usuário (deve ter permissão para criar extensões)
