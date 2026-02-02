# Scripts de Banco de Dados - Painel Clínica

Este diretório contém os scripts SQL necessários para configurar e popular o banco de dados do sistema.

## 📋 Ordem de Execução

Execute os scripts na seguinte ordem:

### 1. Sistema CID-10 Completo (Busca Fuzzy)

**Execute na ordem para habilitar busca fuzzy tipo Google:**

1. **Ativar extensão pg_trgm** (necessária para busca fuzzy)
   ```sql
   database/enable_pg_trgm.sql
   ```

2. **Criar tabela cid_sub_categoria** (estrutura otimizada)
   ```sql
   database/cid10_sub_categoria_table.sql
   ```

3. **Criar função RPC search_cid10** (busca performática)
   ```sql
   database/rpc_search_cid10.sql
   ```

4. **Importar dados do CID-10** (~8.000 códigos)
   - Use o arquivo `subcategoria.sql` do repositório CID10-SQL
   - Execute via SQL Editor do Supabase ou CLI

### 2. Estrutura da Tabela CID-10 (Legado - opcional)
```sql
-- Execute primeiro para criar a tabela antiga (mantida para compatibilidade)
database/cid10_table.sql
```

### 3. Dados de Exemplo do CID-10 (Legado - opcional)
```sql
-- Execute para popular com dados de teste (103 códigos)
database/cid10_sample_data.sql
```

### 4. Atualizações no Medical Records
```sql
-- Adiciona colunas antecedents e conducts
database/add_medical_records_columns.sql
```

### 5. Documentação de Estruturas
```sql
-- Documentação da estrutura JSONB de vitals
database/update_medical_records.sql

-- Documentação dos tipos de macros
database/update_macros.sql
```

## 🔧 Como Executar no Supabase

### Opção 1: Via Painel do Supabase
1. Acesse seu projeto no [Supabase Dashboard](https://app.supabase.com)
2. Vá em **SQL Editor**
3. Copie o conteúdo de cada arquivo `.sql`
4. Cole e execute (clique em "Run")
5. Repita para cada script na ordem acima

### Opção 2: Via CLI do Supabase
```bash
# Instale o Supabase CLI se ainda não tiver
npm install -g supabase

# Login
supabase login

# Execute os scripts
supabase db reset --linked
supabase db push

# Ou execute scripts individuais
psql $DATABASE_URL -f database/cid10_table.sql
psql $DATABASE_URL -f database/cid10_sample_data.sql
```

## 📊 Dados de Teste do CID-10

O arquivo `cid10_sample_data.sql` contém **103 códigos** de exemplo das seguintes categorias:

- ✅ Doenças infecciosas (A00-B99)
- ✅ Neoplasias (C00-D48)
- ✅ Doenças do sangue (D50-D89)
- ✅ Doenças endócrinas (E00-E90) - Diabetes, Obesidade, Colesterol
- ✅ Transtornos mentais (F00-F99) - Depressão, Ansiedade
- ✅ Doenças do sistema nervoso (G00-G99) - Enxaqueca, Insônia
- ✅ Doenças circulatórias (I00-I99) - Hipertensão, Infarto
- ✅ Doenças respiratórias (J00-J99) - Resfriado, Asma, Pneumonia
- ✅ Doenças digestivas (K00-K93) - Gastrite, Refluxo, Síndrome do Intestino Irritável
- ✅ Doenças da pele (L00-L99) - Dermatites, Urticária
- ✅ Doenças osteomusculares (M00-M99) - Artrose, Dor lombar
- ✅ Doenças geniturárias (N00-N99) - ITU, Vaginite
- ✅ Sintomas gerais (R00-R99) - Febre, Cefaleia, Dor abdominal
- ✅ Lesões e traumatismos (S00-T98)
- ✅ Exames de rotina (Z00-Z99) - Check-up, Vacinação

### 🔍 Testando a Busca

Após popular, teste a busca no componente de diagnóstico:

### Busca por Código:
- Digite "A00" → deve mostrar A00.0, A00.1, A00.9 (Cólera)
- Digite "K58" → deve mostrar K58.0, K58.9 (Síndrome do cólon irritável)
- Digite "E11" → deve mostrar códigos de Diabetes tipo 2

### Busca por Descrição:
- Digite "gastroenterite" → deve encontrar diarréia e gastroenterite
- Digite "diabetes" → deve mostrar códigos de diabetes
- Digite "hipertensão" → deve mostrar códigos de pressão alta

### Busca Fuzzy (tolerante a erros):
- Digite "gastroenterit" (falta 'e') → ainda encontra gastroenterite
- Digite "hipertensao" (sem til) → encontra hipertensão
- Digite "diabete" (falta 's') → encontra diabetes

**Recursos da busca:**
- ✅ Busca fuzzy usando trigramas (pg_trgm)
- ✅ Busca por código ou descrição
- ✅ Ordenação por relevância
- ✅ Formatação automática do código (A000 → A00.0)
- ✅ Debounce de 300ms (espera usuário parar de digitar)
- ✅ Retorna até 50 resultados mais relevantes

## 🚀 Para Produção

Para usar em produção, você precisará:

1. **Obter a lista completa do CID-10**
   - Site oficial: [https://www.who.int/classifications/icd/en/](https://www.who.int/classifications/icd/en/)
   - Versão brasileira: DATASUS
   - São mais de 14.000 códigos

2. **Importar em massa**
   ```sql
   COPY cid10(code, description) 
   FROM '/path/to/cid10_completo.csv' 
   DELIMITER ',' 
   CSV HEADER;
   ```

3. **Manter atualizado**
   - O CID-10 é atualizado periodicamente
   - Configure um processo de atualização anual

## ⚠️ Notas Importantes

### CID-10 Subcategoria (Recomendado):
- Os índices GIN Trigram em `cid10_sub_categoria_table.sql` permitem busca fuzzy
- A extensão `pg_trgm` é obrigatória para busca tolerante a erros
- A função RPC `search_cid10` otimiza a busca e formata os códigos automaticamente
- Formata código automaticamente: `A000` → `A00.0`, `A001` → `A00.1`
- Performance excelente (< 200ms para buscas)

### CID-10 Antiga (Legado):
- Os índices criados em `cid10_table.sql` otimizam buscas por código e descrição
- O índice GIN permite busca full-text em português
- Use `ON CONFLICT (code) DO NOTHING` ao inserir dados para evitar duplicatas
- A tabela usa `BIGSERIAL` para suportar mais de 14.000 registros

## 🔗 Relacionamentos

### Nova Implementação (Recomendada):
- Tabela `cid_sub_categoria` - armazena códigos CID-10 completos (~8.000 registros)
- Função RPC `search_cid10` - busca performática com fuzzy search
- Componente `DiagnosisSelect` - usa `supabase.rpc('search_cid10')` para busca em tempo real
- `medical_records.diagnosis` - armazena o código formatado (ex: "A00.0 - Descrição")

### Implementação Antiga (Legado):
- Tabela `cid10` - mantida para compatibilidade

## 📞 Suporte

Se encontrar problemas ao executar os scripts:
1. Verifique as permissões no Supabase
2. Confirme que está conectado ao projeto correto
3. Verifique os logs de erro no SQL Editor
4. Consulte a documentação do Supabase: [https://supabase.com/docs](https://supabase.com/docs)
