# PROMPTS DE IMPLEMENTACAO — Modulo Atendimento Clinica Geral
## Baseado no PRD do Support Clinic v2.13.68

> **COMO USAR:** Copie e cole cada prompt no Claude Code, UM POR VEZ, na ordem.
> Espere cada um terminar antes de colar o proximo.
> O PRD de referencia esta em: `PRD_COMPLETO_SUPPORT_CLINIC.md`

---
---

# ========================================
# FASE 0 — PREPARACAO DO BANCO DE DADOS
# ========================================

> Esses prompts criam as tabelas e colunas novas necessarias.
> EXECUTE TODOS ANTES de comecar as fases de UI.

---

## PROMPT 0.1 — Novos status de agendamento + campos

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secao 6 (MODULO: AGENDA) e secao 6.2.1 (Visualizar Agendamento).

O sistema de referencia tem 11 status de agendamento:
Agendado, Atendido, Atrasado, Cancelado, Confirmado, Desmarcado, Em atendimento, Faltou, Nao atendido, Reagendado, Sala de espera

O meu sistema atual tem estes status no tipo Appointment em src/types/medical.ts:
'scheduled' | 'called' | 'waiting' | 'in_service' | 'waiting_payment' | 'finished' | 'blocked' | 'cancelled' | 'no_show'

Preciso alinhar. Crie uma migration SQL em database/align_appointment_statuses.sql que:

1. Adicione novos status ao campo status da tabela appointments no schema atendimento:
   - 'confirmed' (Confirmado)
   - 'late' (Atrasado)
   - 'unmarked' (Desmarcado)
   - 'rescheduled' (Reagendado)
   - 'not_attended' (Nao atendido)

2. Adicione estes novos campos a tabela appointments:
   - appointment_subtype TEXT (para diferenciar 'orcamento' | 'simples')
   - procedures TEXT[] (array de procedimentos)
   - send_anamnesis BOOLEAN DEFAULT false
   - is_squeeze BOOLEAN DEFAULT false (encaixar horario)
   - is_teleconsultation BOOLEAN DEFAULT false
   - auto_confirm BOOLEAN DEFAULT false
   - generate_budget BOOLEAN DEFAULT false
   - description TEXT
   - scheduled_by TEXT (responsavel pelo agendamento)
   - confirmed_at TIMESTAMPTZ
   - cancelled_at TIMESTAMPTZ
   - rescheduled_from INTEGER REFERENCES appointments(id)

3. Crie uma tabela appointment_status_log no schema atendimento para audit trail:
   - id BIGSERIAL PRIMARY KEY
   - appointment_id INTEGER REFERENCES appointments(id)
   - old_status TEXT
   - new_status TEXT
   - changed_by TEXT
   - changed_at TIMESTAMPTZ DEFAULT now()
   - notes TEXT

4. Atualize o tipo Appointment em src/types/medical.ts adicionando os novos status e campos.

Use o padrao de migrations do projeto. Adicione RLS policies para a nova tabela. O schema e 'atendimento'.
```

---

## PROMPT 0.2 — Tabelas do Prontuario (documentos clinicos separados)

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secoes 5.5 a 5.18 (todos os subitens do Prontuario).

Atualmente o prontuario usa a tabela medical_records com campos JSONB para tudo. Preciso criar tabelas separadas para cada tipo de documento clinico, seguindo o padrao do sistema de referencia. Crie uma migration SQL em database/create_clinical_documents_tables.sql no schema atendimento:

1. **anamneses** — Anamneses independentes (diferente da first_consultation_anamnesis que ja existe como JSONB)
   - id BIGSERIAL PRIMARY KEY
   - patient_id INTEGER NOT NULL
   - doctor_id INTEGER REFERENCES doctors(id)
   - appointment_id INTEGER REFERENCES appointments(id)
   - template_id INTEGER (referencia ao modelo usado)
   - title TEXT
   - content TEXT (rich text HTML)
   - signed BOOLEAN DEFAULT false
   - signed_at TIMESTAMPTZ
   - created_at TIMESTAMPTZ DEFAULT now()

2. **clinical_evolutions** — Evolucoes clinicas
   - id BIGSERIAL PRIMARY KEY
   - patient_id INTEGER NOT NULL
   - doctor_id INTEGER REFERENCES doctors(id)
   - appointment_id INTEGER REFERENCES appointments(id)
   - content TEXT (rich text HTML)
   - signed BOOLEAN DEFAULT false
   - digital_signature BOOLEAN DEFAULT false
   - show_date BOOLEAN DEFAULT true
   - evolution_date DATE DEFAULT CURRENT_DATE
   - created_at TIMESTAMPTZ DEFAULT now()

3. **medical_certificates** — Atestados
   - id BIGSERIAL PRIMARY KEY
   - patient_id INTEGER NOT NULL
   - doctor_id INTEGER REFERENCES doctors(id)
   - template_id INTEGER
   - content TEXT (rich text HTML)
   - signed BOOLEAN DEFAULT false
   - digital_signature BOOLEAN DEFAULT false
   - show_date BOOLEAN DEFAULT true
   - certificate_date DATE DEFAULT CURRENT_DATE
   - created_at TIMESTAMPTZ DEFAULT now()

4. **medical_reports** — Laudos
   - id BIGSERIAL PRIMARY KEY
   - patient_id INTEGER NOT NULL
   - doctor_id INTEGER REFERENCES doctors(id)
   - template_id INTEGER
   - content TEXT (rich text HTML)
   - signed BOOLEAN DEFAULT false
   - digital_signature BOOLEAN DEFAULT false
   - show_date BOOLEAN DEFAULT true
   - report_date DATE DEFAULT CURRENT_DATE
   - created_at TIMESTAMPTZ DEFAULT now()

5. **patient_allergies** — Alergias do paciente
   - id BIGSERIAL PRIMARY KEY
   - patient_id INTEGER NOT NULL
   - allergy_type TEXT NOT NULL (medicamento, alimento, substancia, outro)
   - substance TEXT NOT NULL
   - reaction TEXT
   - severity TEXT (leve, moderada, grave)
   - notes TEXT
   - created_at TIMESTAMPTZ DEFAULT now()

6. **exam_results** — Resultados de exames (separado dos pedidos que ja existem em exam_requests)
   - id BIGSERIAL PRIMARY KEY
   - patient_id INTEGER NOT NULL
   - doctor_id INTEGER REFERENCES doctors(id)
   - exam_name TEXT NOT NULL
   - result_date DATE
   - content TEXT
   - file_url TEXT
   - created_at TIMESTAMPTZ DEFAULT now()

7. **therapeutic_plans** — Planos terapeuticos
   - id BIGSERIAL PRIMARY KEY
   - patient_id INTEGER NOT NULL
   - doctor_id INTEGER REFERENCES doctors(id)
   - title TEXT
   - description TEXT
   - procedures JSONB (procedimentos com sessoes e periodicidade)
   - status TEXT DEFAULT 'active' (active, completed, cancelled)
   - start_date DATE
   - end_date DATE
   - created_at TIMESTAMPTZ DEFAULT now()

8. **patient_attachments** — Anexos
   - id BIGSERIAL PRIMARY KEY
   - patient_id INTEGER NOT NULL
   - file_name TEXT NOT NULL
   - file_url TEXT NOT NULL
   - file_type TEXT
   - file_size INTEGER
   - category TEXT
   - uploaded_by TEXT
   - created_at TIMESTAMPTZ DEFAULT now()

9. **patient_images** — Galeria de imagens
   - id BIGSERIAL PRIMARY KEY
   - patient_id INTEGER NOT NULL
   - image_url TEXT NOT NULL
   - thumbnail_url TEXT
   - title TEXT
   - description TEXT
   - category TEXT
   - taken_at DATE
   - created_at TIMESTAMPTZ DEFAULT now()

10. **clinical_documents** — Documentos/Termos
    - id BIGSERIAL PRIMARY KEY
    - patient_id INTEGER NOT NULL
    - doctor_id INTEGER REFERENCES doctors(id)
    - template_id INTEGER
    - document_type TEXT (termo_consentimento, declaracao, outro)
    - title TEXT
    - content TEXT (rich text HTML)
    - signed BOOLEAN DEFAULT false
    - signed_at TIMESTAMPTZ
    - created_at TIMESTAMPTZ DEFAULT now()

11. **clinical_templates** — Modelos reutilizaveis para anamnese, evolucao, atestado, laudo, documento
    - id BIGSERIAL PRIMARY KEY
    - template_type TEXT NOT NULL (anamnese, evolucao, atestado, laudo, documento, exame)
    - title TEXT NOT NULL
    - content TEXT (HTML template)
    - category TEXT
    - is_default BOOLEAN DEFAULT false
    - created_at TIMESTAMPTZ DEFAULT now()

Adicione RLS policies em todas as tabelas. Adicione indexes em patient_id em todas. Crie os tipos TypeScript correspondentes em src/types/clinical-documents.ts.
```

---

## PROMPT 0.3 — Tabelas de Orcamento e NF-e

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secoes 7 (Financeiro/NF-e) e 8 (Vendas/Orcamentos).

Crie uma migration SQL em database/create_budget_and_nfe_tables.sql no schema atendimento:

1. **budgets** — Orcamentos
   - id BIGSERIAL PRIMARY KEY
   - patient_id INTEGER NOT NULL
   - doctor_id INTEGER REFERENCES doctors(id)
   - status TEXT DEFAULT 'quoted' CHECK (status IN ('pending', 'quoted', 'approved', 'rejected'))
   - items JSONB NOT NULL (array de {procedure_id, procedure_name, sessions, frequency, unit_price})
   - subtotal NUMERIC(10,2)
   - discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed'))
   - discount_value NUMERIC(10,2) DEFAULT 0
   - total NUMERIC(10,2)
   - installments INTEGER DEFAULT 1
   - notes TEXT
   - created_at TIMESTAMPTZ DEFAULT now()
   - approved_at TIMESTAMPTZ

2. **invoices** — Notas fiscais (NF-e)
   - id BIGSERIAL PRIMARY KEY
   - patient_id INTEGER
   - budget_id INTEGER REFERENCES budgets(id)
   - appointment_id INTEGER REFERENCES appointments(id)
   - status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'issued', 'denied', 'error', 'cancelled', 'requesting_auth'))
   - taxpayer_doc TEXT (CPF/CNPJ)
   - taxpayer_name TEXT
   - taxpayer_email TEXT
   - taxpayer_address JSONB (cep, estado, cidade, bairro, endereco, numero, complemento)
   - service_description TEXT
   - notes TEXT
   - amount NUMERIC(10,2)
   - tax_inss NUMERIC(10,2) DEFAULT 0
   - tax_ir NUMERIC(10,2) DEFAULT 0
   - tax_cofins NUMERIC(10,2) DEFAULT 0
   - tax_pis NUMERIC(10,2) DEFAULT 0
   - tax_csll NUMERIC(10,2) DEFAULT 0
   - service_code TEXT
   - iss_retained BOOLEAN DEFAULT false
   - send_by_email BOOLEAN DEFAULT true
   - nfe_number TEXT
   - nfe_url TEXT
   - issued_at TIMESTAMPTZ
   - created_at TIMESTAMPTZ DEFAULT now()

Adicione RLS policies e indexes. Crie os tipos TypeScript em src/types/financial.ts (ou atualize se ja existir).
```

---
---

# ========================================
# FASE 1 — AGENDA DO ATENDIMENTO
# ========================================

> A agenda da Pediatria ja funciona em /src/app/agenda/page.tsx.
> Vamos adaptar para o modulo Atendimento com as features do PRD.

---

## PROMPT 1.1 — Agenda basica do Atendimento (adaptar da Pediatria)

```
A pagina /src/app/atendimento/agenda/page.tsx atualmente e um placeholder que mostra "Em construcao".

A Pediatria ja tem uma agenda completa em /src/app/agenda/page.tsx com componentes em /src/components/agenda/ (DayView, WeekView, AgendaHeader, AgendaSidebar, AppointmentDetailModal, etc).

Tarefa: Adapte a agenda da Pediatria para funcionar no modulo Atendimento.

1. Copie a logica de /src/app/agenda/page.tsx para /src/app/atendimento/agenda/page.tsx
2. Ajuste para usar o schema 'atendimento' via createSchemaClient('atendimento') em vez do schema public
3. Mantenha o tema teal do Atendimento (use as cores do ModuleContext)
4. Reutilize os componentes existentes de /src/components/agenda/ — se precisar de variantes, crie em /src/components/atendimento/agenda/
5. O select de Profissional deve puxar da tabela doctors do schema atendimento
6. Mantenha todas as features: day view, week view, mini calendario lateral, scroll to current time
7. O modal de novo agendamento deve salvar na tabela appointments do schema atendimento

Olhe como os componentes da agenda da Pediatria funcionam e replique a mesma experiencia com tema teal. Nao quebre nada na Pediatria — o codigo deve ser independente.
```

---

## PROMPT 1.2 — Modal de Agendamento completo (Step 2 do PRD)

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secao 6.2 (Modal de Agendamento — Passo 2).

Atualmente o modal de agendamento (NewSlotModal ou similar) e simples. Preciso de um modal completo para o Atendimento com todos os campos do sistema de referencia.

Crie ou refatore o componente de criacao de agendamento em /src/components/atendimento/agenda/NewAppointmentModal.tsx:

**Campos obrigatorios:**
- Paciente* (select com busca — puxa da tabela patients)
- Profissional* (select — puxa da tabela doctors)
- Data* (date picker)
- Hora inicial* (time picker)
- Hora final* (time picker)
- Procedimentos* (multi-select)

**Campos opcionais:**
- Tipo de agendamento: Radio com opcoes "Orcamento" | "Simples"
- Enviar anamnese(s): Select (lista de modelos de anamnese)
- Encaixar horario: Checkbox — permite agendar mesmo se houver conflito
- Teleconsulta: Checkbox
- Agendar como confirmado: Checkbox — status inicial = 'confirmed' ao inves de 'scheduled'
- Gerar orcamento: Checkbox — apos salvar, redireciona para criar orcamento
- Descricao: Textarea

**Sidebar do modal** (quando paciente selecionado):
- Foto/avatar do paciente
- Nome + idade
- Links rapidos: "Prontuario", "Ver cadastro", "Historico de agendamentos"

Use React Hook Form para validacao. Salve na tabela appointments do schema atendimento usando os novos campos criados na migration 0.1. Siga o design system do projeto (Tailwind + tema teal).
```

---

## PROMPT 1.3 — Tela de Visualizar Agendamento (Stepper de Status)

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secao 6.2.1 (Visualizar Agendamento).

Crie a pagina /src/app/atendimento/agenda/[id]/page.tsx com o componente AppointmentView:

**1. Stepper visual de status** (barra horizontal no topo):
Agendado → Confirmado → Sala de espera → Em atendimento → Atendido
- Cada step mostra icone + label
- Step atual fica destacado (cor teal)
- Steps concluidos ficam com check verde
- Steps futuros ficam cinza

**2. Acoes rapidas** (botoes no header):
- Icone WhatsApp (abre conversa do paciente)
- Botao "GERAR ORCAMENTO" (azul)
- Menu 3 pontos com: Clonar agendamento, Editar informacoes, Cancelar agendamento, Ajustar status

**3. Detalhes do agendamento** (cards read-only):
- Procedimento(s)
- Data e Hora (inicial e final)
- Profissional
- Descricao
- Responsavel pelo agendamento
- Data de agendamento

**4. Botoes de acao** no footer:
- "CANCELAR AGENDAMENTO" (vermelho outline)
- "EDITAR INFORMACOES" (azul)

**5. Secao colapsavel "Alteracoes de status":**
- Lista do audit trail da tabela appointment_status_log
- Mostra: data/hora, status anterior → novo status, responsavel

Busque os dados da tabela appointments + appointment_status_log do schema atendimento. Crie o componente de Stepper reutilizavel em /src/components/ui/StatusStepper.tsx.
```

---

## PROMPT 1.4 — Gerenciar Agendamentos (Listagem com filtros)

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secao 6.3 (Gerenciar Agendamentos).

Crie a pagina /src/app/atendimento/agenda/gerenciar/page.tsx:

**Filtros:**
- Paciente (input com busca)
- Profissional (select)
- Status (select com os 11 status: agendado, atendido, atrasado, cancelado, confirmado, desmarcado, em_atendimento, faltou, nao_atendido, reagendado, sala_de_espera)
- Procedimento (select)
- De / Ate (date range)
- Botao PESQUISAR

**Tabela:**
| Paciente | Descricao | Profissional | Status | Data | Opcoes |
- Status renderizado como badge colorido
- Coluna Opcoes: icone olho (visualizar), lapis (editar), 3 pontos (clonar, cancelar)

**Features:**
- Paginacao (10/25/50 itens por pagina)
- Ordenacao por coluna
- Export para PDF (botao no header)

Busque da tabela appointments do schema atendimento. Use o padrao de listagem do projeto. Adicione link para esta pagina na sidebar/header da agenda.
```

---

## PROMPT 1.5 — Historico de Agendamentos do Paciente

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secao 6.2.2 (Historico de Agendamentos do Paciente).

Crie o componente /src/components/atendimento/agenda/PatientAppointmentHistory.tsx:

**Acesso:** Via link na sidebar do modal de agendamento ou na ficha do paciente.

**Filtros:**
- Profissional (select)
- Status (select com 11 status)
- De / Ate (date range)

**Tabela:**
| Agendamento (ID) | Status (badge) | Profissional | Data/Hora | Opcoes |
- Opcoes: visualizar (olho), editar (lapis)

**Botao Export PDF** no header.

Busque appointments WHERE patient_id = {id} do schema atendimento. Este componente deve ser usado tanto como pagina standalone (/src/app/atendimento/agenda/historico/[patientId]/page.tsx) quanto como modal/drawer reutilizavel.
```

---

## PROMPT 1.6 — Bloqueio de Agenda

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secao 6.4 (Bloqueio de Agenda).

Crie uma tabela (se nao existir) e a pagina de bloqueios:

**Migration** database/create_schedule_blocks_table.sql (schema atendimento):
- id BIGSERIAL PRIMARY KEY
- doctor_id INTEGER REFERENCES doctors(id)
- title TEXT
- start_date DATE NOT NULL
- end_date DATE NOT NULL
- start_time TIME
- end_time TIME
- all_day BOOLEAN DEFAULT false
- recurrence TEXT (none, daily, weekly, monthly)
- notes TEXT
- created_at TIMESTAMPTZ DEFAULT now()

**Pagina** /src/app/atendimento/agenda/bloqueios/page.tsx:
- Listagem de bloqueios com filtros (profissional, data)
- Tabela: Profissional, Titulo, Data inicial, Data final, Horario, Opcoes
- Botao ADICIONAR BLOQUEIO → modal com os campos acima
- Na agenda (DayView/WeekView), os horarios bloqueados devem aparecer como slots cinza/desabilitados

Siga o design do projeto. Adicione RLS na migration.
```

---
---

# ========================================
# FASE 2 — PRONTUARIO DO PACIENTE
# ========================================

> O prontuario ja tem 15 abas funcionando.
> Esses prompts adicionam as features que faltam do PRD.

---

## PROMPT 2.1 — Sidebar do Prontuario estilo Support Clinic

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secao 5.2 (Sidebar do Prontuario).

O prontuario atual usa AttendanceSidebar.tsx com abas horizontais/verticais. O sistema de referencia tem uma sidebar fixa lateral esquerda com 15 itens:

1. Prontuario (dados basicos)
2. Historico (timeline)
3. Anamneses
4. Alergias
5. Evolucoes
6. Receitas
7. Atestados
8. Laudos
9. Exames > (submenu: Pedidos | Resultados)
10. Planos
11. Anexos
12. Dietas
13. CID's
14. Galeria de imagens
15. Documentos

Refatore /src/components/medical-record/attendance/AttendanceSidebar.tsx para:
1. Manter os itens existentes que ja funcionam (overview, routine, vitals, etc)
2. Adicionar os itens que faltam: Alergias (dedicado), Evolucoes (dedicado), Atestados, Laudos, Galeria de imagens, Documentos/Termos
3. O item "Exames" deve ter um submenu expansivel com "Pedidos" e "Resultados"
4. Cada item deve ter seu icone do Lucide React
5. Manter o indicador visual de qual secao esta ativa
6. Manter o timer de consulta no topo da sidebar
7. Manter o botao "Finalizar atendimento" no final

NAO quebre as abas que ja funcionam. Adicione as novas apontando para componentes placeholder por enquanto (vamos implementar nos proximos prompts).
```

---

## PROMPT 2.2 — Tela de Anamneses (listagem + formulario)

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secao 5.5 (Anamneses).

O sistema ja tem FirstConsultationAnamnesis.tsx como um formulario embutido. Agora preciso de uma tela de Anamneses INDEPENDENTE que lista e cria anamneses como documentos separados (usando a tabela anamneses criada na migration 0.2).

Crie /src/components/medical-record/screens/AnamnesesList.tsx:

**Listagem:**
- Tabela: Data de criacao | Data do preenchimento | Nome (titulo) | Profissional | Opcoes
- Botao "ADICIONAR ANAMNESE" no header
- Opcoes por linha: visualizar (olho), editar (lapis), excluir (lixeira), imprimir (impressora)

**Modal/Pagina de criacao:**
- Campo: Titulo / Nome da anamnese
- Toggle: Assinar digitalmente
- Toggle: Mostrar data (mostra/esconde campo de data)
- Campo: Data (date picker)
- Editor Rich Text (WYSIWYG) para o conteudo — use um editor como TipTap ou o que ja existir no projeto
- Painel lateral: "Modelos de anamnese" — lista de templates da tabela clinical_templates WHERE template_type = 'anamnese'. Ao clicar num modelo, preenche o editor com o conteudo do template.
- Botoes: SALVAR | CANCELAR

Crie tambem o hook /src/hooks/atendimento/useAnamneses.ts com CRUD completo usando a tabela anamneses do schema atendimento.

Registre esta tela no AttendanceLayout.tsx como nova aba.
```

---

## PROMPT 2.3 — Tela de Evolucoes Clinicas

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secao 5.7 (Evolucoes).

Crie /src/components/medical-record/screens/EvolutionsList.tsx seguindo o MESMO padrao da tela de Anamneses (prompt 2.2), mas para evolucoes clinicas:

**Listagem:**
- Tabela: Data de criacao | Data da evolucao | Profissional | Opcoes
- Botao "ADICIONAR EVOLUCAO"

**Formulario de criacao:**
- Toggle: Assinar digitalmente
- Toggle: Mostrar data
- Campo: Data da evolucao
- Editor Rich Text para conteudo
- Painel lateral: Modelos de evolucao (clinical_templates WHERE template_type = 'evolucao')
- Botoes: SALVAR | CANCELAR

Crie o hook /src/hooks/atendimento/useEvolutions.ts com CRUD. Use a tabela clinical_evolutions do schema atendimento. Registre no AttendanceLayout.tsx.
```

---

## PROMPT 2.4 — Tela de Alergias

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secao 5.6 (Alergias).

O sistema atual tem alergias como parte do ClinicalSummaryGrid (6 cards fixos). Preciso de uma tela DEDICADA.

Crie /src/components/medical-record/screens/AllergiesList.tsx:

**Listagem:**
- Cards ou tabela mostrando alergias do paciente
- Cada alergia mostra: Tipo (medicamento/alimento/substancia/outro), Substancia, Reacao, Gravidade (badge colorido: leve=verde, moderada=amarelo, grave=vermelho)
- Botao "ADICIONAR ALERGIA"

**Modal de criacao:**
- Tipo de alergia* (select: Medicamento, Alimento, Substancia, Outro)
- Substancia* (input com autocomplete se possivel)
- Reacao (textarea)
- Gravidade (select: Leve, Moderada, Grave)
- Observacoes (textarea)

Crie o hook /src/hooks/atendimento/useAllergies.ts. Use a tabela patient_allergies do schema atendimento. Registre no AttendanceLayout.tsx.

IMPORTANTE: Mantenha o ClinicalSummaryGrid funcionando — ele pode puxar um resumo das alergias desta nova tabela.
```

---

## PROMPT 2.5 — Telas de Atestados e Laudos

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secoes 5.10 (Atestados) e 5.11 (Laudos).

Ambas as telas seguem o MESMO padrao de Anamneses/Evolucoes. Crie:

1. /src/components/medical-record/screens/CertificatesList.tsx (Atestados)
2. /src/components/medical-record/screens/ReportsList.tsx (Laudos)

Para cada uma:

**Listagem:**
- Tabela: Data de criacao | Data | Nome/Titulo | Profissional | Opcoes
- Botao "ADICIONAR ATESTADO" / "ADICIONAR LAUDO"
- Opcoes: visualizar, editar, excluir, imprimir

**Formulario:**
- Toggle: Assinar digitalmente
- Toggle: Mostrar data
- Campo: Data
- Editor Rich Text
- Painel lateral de modelos (clinical_templates WHERE template_type = 'atestado' ou 'laudo')
- Botoes: SALVAR | CANCELAR

Crie hooks:
- /src/hooks/atendimento/useCertificates.ts (tabela medical_certificates)
- /src/hooks/atendimento/useReports.ts (tabela medical_reports)

Registre ambas no AttendanceLayout.tsx. Use o mesmo componente base de editor rico — se possivel extraia um componente reutilizavel ClinicalDocumentEditor.tsx que todas essas telas compartilham.
```

---

## PROMPT 2.6 — Exames: Pedidos e Resultados (submenu)

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secao 5.12 (Exames — Pedidos e Resultados).

O sistema ja tem ExamsAndProcedures.tsx para pedidos de exame com TUSS. Preciso ajustar e adicionar a aba de Resultados.

1. **Refatore ExamsAndProcedures.tsx** para ter 2 sub-abas internas:
   - "Pedidos" (o que ja existe — listagem de exam_requests)
   - "Resultados" (novo — listagem de exam_results)

2. **Pedidos** (ajustes):
   - Listagem: Data de criacao | Data do exame | Nome | Profissional | Opcoes
   - O formulario de criacao ja funciona — mantenha
   - Adicione painel lateral "Tipos de pedidos" com categorias de templates (clinical_templates WHERE template_type = 'exame')

3. **Resultados** (novo):
   - Listagem: Data | Nome do exame | Profissional | Opcoes
   - Botao "ADICIONAR RESULTADO"
   - Formulario: Nome do exame, Data do resultado, Conteudo (texto ou upload de arquivo), Profissional
   - Use a tabela exam_results do schema atendimento

Crie hook /src/hooks/atendimento/useExamResults.ts. Atualize o registro no AttendanceLayout.
```

---

## PROMPT 2.7 — Timeline / Historico do Paciente

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secao 5.4 (Historico do Paciente — Timeline).

O sistema ja tem ClinicalTimeline.tsx. Verifique se ele implementa:

1. **Filtros:**
   - Profissional (select)
   - Tipo de registro (multi-select: Anamnese, Evolucao, Receita, Atestado, Laudo, Exame, Documento)
   - De / Ate (date range)
   - Botao PESQUISAR

2. **Linha do tempo:**
   - Linha vertical com marcadores por data
   - Cada entrada mostra: icone do tipo, titulo, data/hora, profissional, preview do conteudo
   - Ao clicar expande o conteudo completo
   - Badge de cor por tipo (anamnese=azul, evolucao=verde, receita=roxo, atestado=laranja, laudo=vermelho, exame=ciano)

3. **Dados:** Deve agregar registros de TODAS as tabelas clinicas:
   - anamneses, clinical_evolutions, prescriptions, medical_certificates, medical_reports, exam_requests, exam_results, clinical_documents
   - Ordena por data decrescente

Se o ClinicalTimeline.tsx ja faz isso, apenas ajuste para incluir as novas tabelas. Se nao, refatore para suportar tudo.
```

---

## PROMPT 2.8 — Planos Terapeuticos

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secao 5.13 (Planos).

Crie /src/components/medical-record/screens/TherapeuticPlans.tsx:

**Listagem:**
- Cards ou tabela: Titulo | Status (badge: ativo=verde, concluido=azul, cancelado=vermelho) | Data inicio | Data fim | Profissional | Opcoes
- Botao "ADICIONAR PLANO"

**Formulario:**
- Titulo*
- Profissional*
- Data inicio
- Data fim estimada
- Descricao (textarea)
- Procedimentos (tabela dinamica):
  | Procedimento (select) | Sessoes | Frequencia (semanal/quinzenal/mensal) | Status |
  - Botao + para adicionar linha
- Botoes: SALVAR | CANCELAR

Use a tabela therapeutic_plans do schema atendimento. Crie hook /src/hooks/atendimento/useTherapeuticPlans.ts. Registre no AttendanceLayout.
```

---

## PROMPT 2.9 — Galeria de Imagens e Anexos

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secoes 5.14 (Anexos) e 5.17 (Galeria de Imagens).

O sistema ja tem ImagesAndAttachments.tsx. Verifique se atende e ajuste:

1. **Anexos** (/src/components/medical-record/screens/AttachmentsList.tsx):
   - Listagem com colunas: Nome do arquivo | Tipo | Tamanho | Categoria | Data upload | Opcoes (download, excluir)
   - Botao "ADICIONAR ANEXO" → upload de arquivo (PDF, DOC, imagem, etc)
   - Upload para Supabase Storage
   - Use a tabela patient_attachments

2. **Galeria de Imagens** (/src/components/medical-record/screens/ImageGallery.tsx):
   - Grid de thumbnails (4 colunas)
   - Cada imagem: thumbnail + titulo + data
   - Ao clicar: modal com imagem full-size + zoom + comparacao lado a lado
   - Botao "ADICIONAR IMAGEM" → upload com titulo e categoria
   - Upload para Supabase Storage
   - Use a tabela patient_images

Se ImagesAndAttachments.tsx ja cobre parte, refatore para separar em 2 componentes distintos (cada um com sua aba na sidebar).
```

---
---

# ========================================
# FASE 3 — PACIENTES (LISTAGEM ATENDIMENTO)
# ========================================

---

## PROMPT 3.1 — Pagina de Pacientes do Atendimento

```
A pagina /src/app/atendimento/clients/page.tsx atualmente e um placeholder "Em construcao".

A Pediatria ja tem uma listagem de pacientes funcionando. Adapte para o Atendimento:

1. Copie a logica de listagem de pacientes existente (PatientListTable, PatientRegistrationForm, NewPatientModal)
2. Ajuste para usar o schema 'atendimento'
3. Aplique o tema teal

**Listagem deve ter:**
- Barra de busca (nome, telefone, CPF)
- Filtro: Ativo | Inativo | Todos
- Select de itens por pagina: 10 | 25 | 50
- Tabela: Registro (ID) | Nome | Telefone | Convenio | Data nasc. | Opcoes
- Opcoes: Prontuario (link), Editar, Historico de agendamentos
- Botao "ADICIONAR PACIENTE" que abre o formulario/modal de cadastro

**Formulario de cadastro** deve ter todos os campos do tipo Patient em src/types/patient.ts, organizados em abas ou secoes:
- Dados pessoais (nome, CPF, RG, data nasc, sexo, nome social)
- Contato (telefone, celular, email)
- Endereco (CEP com busca automatica, rua, numero, bairro, cidade, estado)
- Dados complementares (profissao, escolaridade, etnia, religiao)
- Convenio (plano, numero da carteira, validade)
- Responsavel (nome do pai, mae)

Reutilize os componentes existentes sempre que possivel.
```

---
---

# ========================================
# FASE 4 — MODULOS COMPLEMENTARES
# ========================================

---

## PROMPT 4.1 — Modulo de Orcamentos

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secao 8 (MODULO: VENDAS — ORCAMENTOS).

Crie o modulo de orcamentos:

**Pagina de listagem:** /src/app/atendimento/orcamentos/page.tsx

Filtros: Paciente, Profissional, Status (Pendente/Orcado/Aprovado/Rejeitado), De, Ate
Tabela: Registro | Paciente | Profissional | Valor | Desconto | Total | Data | Status | Opcoes

**Pagina de criacao:** /src/app/atendimento/orcamentos/criar/page.tsx

Formulario:
- Paciente* (select com busca)
- Profissional* (select)
- Tabs: PROCEDIMENTOS | PROTOCOLOS
- Tabela de itens do orcamento:
  | Procedimento | Sessoes | Valor unit. | Subtotal | Acoes (remover) |
  - Botao + para adicionar procedimento
- Totalizador:
  - Subtotal (soma automatica)
  - Desconto: toggle entre % e R$ + campo de valor
  - Valor total (subtotal - desconto)
  - Parcelas (input numerico)
- Observacoes (textarea)
- Botoes: "SALVAR E SAIR" | "LIBERAR ORCAMENTO"

Use a tabela budgets do schema atendimento. Crie hook /src/hooks/atendimento/useBudgets.ts. Adicione link na sidebar do Atendimento.
```

---

## PROMPT 4.2 — Modulo Financeiro (NF-e)

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secao 7 (MODULO: FINANCEIRO — NF-e).

O Atendimento ja tem /src/app/atendimento/financeiro com alguma implementacao. Adicione a funcionalidade de NF-e:

**Pagina de listagem de NF-e:** /src/app/atendimento/financeiro/nfe/page.tsx

Filtros: De, Ate, Status (Processando/Emitida/Negada/Erro/Cancelada/Solicitando Autorizacao)
Tabela: Registro | Paciente | Valor | Status (badge) | Data | Opcoes

**Pagina de Gerar NF-e:** /src/app/atendimento/financeiro/nfe/gerar/page.tsx

Secao 1 — DADOS DO TOMADOR:
- CPF/CNPJ* (com mascara)
- Nome*
- CEP (com busca automatica de endereco)
- Estado, Cidade, Bairro, Endereco, Numero, Complemento
- E-mail
- Toggle: "Salvar dados do tomador" (salva nos dados do paciente)

Secao 2 — INFORMACOES DA NOTA FISCAL:
- Descricao do servico* (textarea)
- Observacoes (textarea)
- Valor da nota* (input monetario)
- Impostos: INSS, IR, COFINS, PIS, CSLL (inputs monetarios, todos opcionais)
- Servico (select — lista de servicos da clinica)
- Gerar NFe por (select)
- ISS retido na fonte (checkbox)
- Enviar nota por e-mail (checkbox, default: true)

Botao: GERAR NF-E

Use a tabela invoices do schema atendimento. Crie hook /src/hooks/atendimento/useInvoices.ts.

NOTA: A integracao real com prefeitura nao precisa funcionar agora — apenas salve os dados e simule o fluxo de status.
```

---
---

# ========================================
# FASE 5 — DASHBOARD DE METRICAS
# ========================================

---

## PROMPT 5.1 — Dashboard do Atendimento

```
Leia o arquivo PRD_COMPLETO_SUPPORT_CLINIC.md, secao 3 (HOME/DASHBOARD).

O Atendimento ja tem /src/app/atendimento/dashboard. Verifique se implementa todos os elementos do PRD e ajuste:

**Filtros:**
- Periodo (select: Hoje, Semana, Mes, Trimestre, Ano)
- Profissional (select)
- Botao PESQUISAR

**KPI Cards (4):**
1. Agendamentos (roxo/azul) — total de appointments no periodo
2. Pacientes Confirmados (azul claro) — WHERE status = 'confirmed'
3. Pacientes que Faltaram (vermelho) — WHERE status = 'no_show'
4. Pacientes Atendidos (verde) — WHERE status = 'finished'

**Coluna lateral "Pacientes do dia":**
- Lista dos agendamentos de hoje para o profissional selecionado
- Mostra nome + horario + status
- "Nao ha agendamentos no dia!" quando vazio

**Graficos:**
1. Atendimentos por periodo (grafico de barras — Recharts)
2. Atendimentos por convenio (grafico de pizza colapsavel)
3. Procedimentos realizados (lista/tabela colapsavel)
4. Aniversariantes (tabela: Paciente | Data — pacientes com aniversario no periodo)

Cada widget deve ter botoes de expandir/colapsar e fechar.

Busque tudo das tabelas do schema atendimento. Use Recharts para graficos (ja esta instalado).
```

---
---

# ========================================
# FASE 6 — POLIMENTO E INTEGRACAO
# ========================================

---

## PROMPT 6.1 — Componente reutilizavel de Editor Rico Clinico

```
Varias telas do prontuario usam um editor de texto rico (anamneses, evolucoes, atestados, laudos, documentos). Crie um componente reutilizavel:

/src/components/medical-record/shared/ClinicalDocumentEditor.tsx

Props:
- value: string (HTML content)
- onChange: (html: string) => void
- placeholder?: string
- showToolbar?: boolean (default true)
- readOnly?: boolean
- showSignature?: boolean (mostra toggle de assinatura digital)
- showDateToggle?: boolean (mostra toggle de exibir data)
- templateType?: string (tipo de template para carregar modelos)
- onSave?: () => void
- onCancel?: () => void

Features:
- Toolbar: Bold, Italic, Underline, Lists (ol/ul), Heading, Align, Table, Image insert
- Painel lateral de modelos (opcional): quando templateType e fornecido, mostra lista de clinical_templates
- Preview de impressao
- Suporte a variaveis: {{paciente_nome}}, {{paciente_idade}}, {{profissional_nome}}, {{data_atual}} — substituidas automaticamente

Use TipTap (se ja instalado) ou contentEditable com execCommand como fallback. Verifique o que ja existe no projeto primeiro.
```

---

## PROMPT 6.2 — Navegacao e Sidebar do Atendimento

```
Verifique o arquivo /src/config/modules.ts e a sidebar do Atendimento.

Garanta que a sidebar do modulo Atendimento tenha TODOS os links:
1. Chat (atendimento principal)
2. Agenda → /atendimento/agenda
3. Gerenciar Agendamentos → /atendimento/agenda/gerenciar
4. Bloqueios → /atendimento/agenda/bloqueios
5. Pacientes → /atendimento/clients
6. Orcamentos → /atendimento/orcamentos
7. Financeiro → /atendimento/financeiro
8. NF-e → /atendimento/financeiro/nfe
9. Dashboard → /atendimento/dashboard
10. Relatorios → /atendimento/relatorios
11. CRM → /atendimento/crm
12. Automacoes → /atendimento/automatizacoes
13. Configuracoes → /atendimento/configuracoes
14. Tasks → /atendimento/tasks

Organize com icones do Lucide React. Agrupe itens relacionados (Agenda com sub-itens, Financeiro com sub-itens). Destaque o item ativo baseado na URL atual. Use o tema teal.
```

---

## PROMPT 6.3 — Revisao final e tipos TypeScript

```
Faca uma revisao completa dos tipos TypeScript do projeto:

1. Verifique se todos os novos tipos em src/types/clinical-documents.ts e src/types/financial.ts estao corretos e completos
2. Verifique se o tipo Appointment em src/types/medical.ts inclui todos os novos campos das migrations
3. Verifique se todos os hooks criados exportam tipos corretos
4. Verifique se nao ha erros de TypeScript no projeto (rode: npx tsc --noEmit)
5. Corrija qualquer erro encontrado

Tambem verifique se todas as novas paginas estao acessiveis via navegacao (sidebar links) e se o roteamento esta correto no Next.js App Router.
```

---
---

# ========================================
# NOTAS IMPORTANTES
# ========================================

## Ordem de execucao recomendada:
1. FASE 0 (migrations) — OBRIGATORIO PRIMEIRO
2. FASE 1 (Agenda) — pode comecar apos Fase 0
3. FASE 2 (Prontuario) — pode comecar apos Fase 0, paralelo com Fase 1
4. FASE 3 (Pacientes) — apos Fase 1
5. FASE 4 (Orcamentos + NF-e) — apos Fase 0
6. FASE 5 (Dashboard) — apos Fases 1-4
7. FASE 6 (Polimento) — por ultimo

## Schema do Supabase:
- Todas as tabelas do Atendimento ficam no schema `atendimento`
- Use `createSchemaClient('atendimento')` ou `createSchemaAdminClient('atendimento')` para acessar
- Arquivos de referencia: src/lib/supabase/schemaClient.ts e schemaServer.ts

## Design System:
- Tailwind CSS com tema teal para o modulo Atendimento
- Cores definidas em src/config/modules.ts
- Dark mode suportado (usar classes dark:)
- Icones: Lucide React
- Graficos: Recharts
- Forms: React Hook Form

## PRD de referencia:
- Arquivo: PRD_COMPLETO_SUPPORT_CLINIC.md (na raiz do projeto)
- Contem TODOS os campos, status, fluxos e logicas mapeados do sistema Support Clinic v2.13.68
