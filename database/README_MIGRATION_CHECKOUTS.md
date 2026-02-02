# Migration: Adicionar Campos ao medical_checkouts

## ⚠️ IMPORTANTE: Execute esta migration antes de usar o modal de finalização

O modal de finalização de consulta requer que os seguintes campos existam na tabela `medical_checkouts`:

- `consultation_value` (NUMERIC) - Valor da consulta
- `patient_id` (BIGINT) - ID do paciente
- `appointment_id` (BIGINT) - ID do agendamento

## Como Executar

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Copie e cole o conteúdo do arquivo `database/add_consultation_value_to_checkouts.sql`
4. Execute o script

## Verificação

Após executar, você pode verificar se as colunas foram criadas executando:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'medical_checkouts'
AND column_name IN ('consultation_value', 'patient_id', 'appointment_id');
```

## Nota

O código está preparado para funcionar mesmo sem essas colunas (usando fallback), mas para funcionalidade completa, execute a migration.
