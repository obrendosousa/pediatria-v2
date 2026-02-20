# Implementação da Tela de Atendimento Médico (iClinic Clone)

## 📋 Resumo da Implementação

Esta implementação cria a tela de "Atendimento Médico" clonando a interface do iClinic, com integração completa ao Supabase.

## 🗄️ Atualizações no Banco de Dados

### 1. Tabela CID10
Execute o SQL em `database/cid10_table.sql` no Supabase para criar a tabela de códigos CID-10.

**Importante:** Você precisará popular a tabela `cid10` com os dados reais do CID-10 brasileiro. Exemplos de inserção estão comentados no arquivo SQL.

### 2. Estrutura de Dados

- **`medical_records.vitals`** (JSONB): Armazena `{ weight, height, imc, pe }`
- **`macros.type`**: Usado para diferenciar tipos de modelos ('physical_exam', 'anamnesis', 'conduct', 'hda', 'antecedents')

## 📁 Arquivos Criados

### Hooks
- `src/hooks/useMedicalRecord.ts` - Hook para gerenciar prontuários médicos

### Componentes
- `src/components/medical-record/attendance/RichTextEditor.tsx` - Editor de texto rico com toolbar
- `src/components/medical-record/attendance/DiagnosisSelect.tsx` - Busca assíncrona de diagnósticos CID10
- `src/components/medical-record/attendance/ModelTemplateModal.tsx` - Modal para salvar/usar modelos
- `src/components/medical-record/attendance/AttendanceForm.tsx` - Formulário principal de atendimento

### SQL
- `database/cid10_table.sql` - Criação da tabela CID10
- `database/update_medical_records.sql` - Documentação da estrutura vitals
- `database/update_macros.sql` - Documentação dos tipos de modelos

## 🚀 Funcionalidades Implementadas

### 1. Seção Anamnese
- ✅ Input para queixa principal (`chief_complaint`)
- ✅ RichTextEditor para HDA (História da Moléstia Atual)
- ✅ RichTextEditor para histórico e antecedentes
- ✅ Botões "Salvar Modelo" e "Usar Modelo" em cada editor

### 2. Seção Exame Físico & Vitals
- ✅ RichTextEditor para exame físico
- ✅ Calculadora IMC automática (Peso em kg, Altura em cm)
- ✅ Campos para Perímetro Cefálico (PE)

### 3. Seção Diagnóstico
- ✅ AsyncSelect com busca em tempo real na tabela `cid10`
- ✅ Adicionar múltiplos diagnósticos
- ✅ Lista de diagnósticos adicionados com opção de remover

### 4. Seção Condutas
- ✅ RichTextEditor para condutas
- ✅ Suporte a modelos

### 5. Barra de Ações
- ✅ Botão "Salvar" (atualiza `medical_records` com status 'draft')
- ✅ Botão "Finalizar Atendimento" (atualiza status para 'signed' e `finished_at`)

## 🔧 Como Usar

### 1. Execute os Scripts SQL
```sql
-- No Supabase SQL Editor, execute:
-- 1. database/cid10_table.sql
-- 2. Popule a tabela cid10 com dados reais
```

### 2. Integração nas Telas
O `AttendanceForm` já está integrado em:
- `AttendanceOverview` (tela "Atendimento (Visão Geral)")

### 3. Uso do Hook
```typescript
const { record, isLoading, saveRecord, finishRecord } = useMedicalRecord(patientId, appointmentId);
```

## 📝 Notas Importantes

1. **Campo `antecedents`**: Atualmente não existe na tabela `medical_records`. Você pode:
   - Adicionar a coluna `antecedents TEXT` na tabela
   - Ou usar o campo `hda` para ambos (história e antecedentes)

2. **População da Tabela CID10**: É necessário popular a tabela `cid10` com os códigos reais do CID-10 brasileiro. Você pode:
   - Importar de um arquivo CSV
   - Usar uma API pública do CID-10
   - Inserir manualmente os códigos mais usados

3. **Modelos de Texto**: Os modelos são salvos na tabela `macros` com o campo `type` indicando o tipo:
   - `'hda'` - História da Moléstia Atual
   - `'antecedents'` - Antecedentes
   - `'physical_exam'` - Exame Físico
   - `'conduct'` - Condutas

## 🎨 Design

O design segue o padrão iClinic:
- Layout limpo e organizado
- Seções bem delimitadas
- Botões de ação à direita
- Editor de texto rico com toolbar completa
- Busca de diagnósticos com autocomplete

## 🔄 Próximos Passos

1. Adicionar campo `antecedents` na tabela `medical_records` (se necessário)
2. Popular tabela `cid10` com dados reais
3. Testar fluxo completo de salvar/finalizar atendimento
4. Adicionar validações de formulário
5. Implementar outras telas de atendimento (Consulta de Rotina, etc.)
