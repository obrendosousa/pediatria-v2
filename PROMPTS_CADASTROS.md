# Prompts de Implementação — Módulo Cadastros

> Copie cada prompt no Claude Code e execute um por um, na ordem.
> Cada prompt referencia o PRD em `PRD_CADASTROS_SUPPORT_CLINIC.md`.
> Schema do banco: `atendimento` (via `createSchemaClient('atendimento')`)

---

## FASE 0 — Migrations e Infraestrutura

### Prompt 0.1 — Migration: Tabelas de Cadastros Gerais

```
Leia o arquivo PRD_CADASTROS_SUPPORT_CLINIC.md (seções 2.1 e 2.2) e crie uma migration SQL em database/ chamada create_cadastros_gerais_tables.sql.

Crie as seguintes tabelas no schema atendimento:

1. collaborators — campos: id (uuid PK default gen_random_uuid()), name (text NOT NULL), sex (text), birth_date (date), marital_status (text), cpf (text UNIQUE NOT NULL), rg (text), street (text), zip_code (text), state (text), city (text), neighborhood (text), number (text), complement (text), email (text NOT NULL), phone (text), mobile (text), whatsapp (text), role (text NOT NULL CHECK in: 'administrator','administrative_assistant','other','receptionist','seller'), schedule_access (text NOT NULL CHECK in: 'view_appointment','open_record'), is_admin (boolean DEFAULT false), attachments (jsonb DEFAULT '[]'), notes (text), status (text DEFAULT 'active' CHECK in: 'active','inactive'), created_by (uuid), created_at (timestamptz DEFAULT now()), updated_at (timestamptz DEFAULT now())

2. professionals — herda conceito de collaborators mas é tabela separada com campos adicionais: id, name, sex, birth_date, marital_status, cpf (UNIQUE NOT NULL), rg, street, zip_code, state, city, neighborhood, number, complement, email (NOT NULL), phone, mobile, whatsapp, professional_type (text NOT NULL), specialty (text), registration_state (text NOT NULL), registration_type (text NOT NULL), registration_number (text NOT NULL), schedule_access (text NOT NULL), is_admin (boolean DEFAULT false), restrict_prices (boolean DEFAULT false), has_schedule (boolean DEFAULT false), restrict_schedule (boolean DEFAULT false), attachments (jsonb DEFAULT '[]'), notes (text), status (text DEFAULT 'active'), created_by (uuid), created_at, updated_at

Adicione RLS habilitado em ambas as tabelas. Crie policies para authenticated users (SELECT, INSERT, UPDATE, DELETE).

Crie também os tipos TypeScript correspondentes em src/types/cadastros.ts com interfaces Collaborator e Professional.
```

---

### Prompt 0.2 — Migration: Tabelas Clínico (Procedimentos, Protocolos, Parceiros)

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seção 3) e crie uma migration SQL em database/ chamada create_clinico_tables.sql.

Crie no schema atendimento:

1. procedures — id (uuid PK), name (text NOT NULL), procedure_type (text NOT NULL CHECK in: 'consultation','exam','injectable','other'), duration_minutes (integer NOT NULL), composition_enabled (boolean DEFAULT false), fee_value (numeric(10,2) DEFAULT 0), total_value (numeric(10,2) DEFAULT 0), status (text DEFAULT 'active'), created_by (uuid), created_at, updated_at

2. procedure_compositions — id (uuid PK), procedure_id (uuid FK→procedures), sub_procedure_id (uuid FK→procedures), quantity (integer DEFAULT 1), created_at

3. clinical_protocols — id (uuid PK), name (text NOT NULL), description (text), total_value (numeric(10,2) DEFAULT 0), status (text DEFAULT 'active'), created_by (uuid), created_at, updated_at

4. clinical_protocol_items — id (uuid PK), protocol_id (uuid FK→clinical_protocols), procedure_id (uuid FK→procedures), sort_order (integer DEFAULT 0), created_at

5. partners — id (uuid PK), name (text NOT NULL), email (text NOT NULL), phone (text), whatsapp (text), notes (text), status (text DEFAULT 'active'), created_by (uuid), created_at, updated_at

Adicione RLS e policies. Atualize src/types/cadastros.ts com interfaces Procedure, ClinicalProtocol, Partner.
```

---

### Prompt 0.3 — Migration: Tabelas Receituário

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seção 4) e crie uma migration SQL em database/ chamada create_receituario_tables.sql.

Crie no schema atendimento:

1. substances — id (uuid PK), name (text NOT NULL), created_by (uuid), created_at, updated_at

2. formulas — id (uuid PK), name (text NOT NULL), route_of_use (text NOT NULL), form (text NOT NULL), quantity (numeric NOT NULL), unit (text NOT NULL), posology (text NOT NULL), reference (text), notes (text), status (text DEFAULT 'active'), created_by (uuid), created_at, updated_at

3. formula_compositions — id (uuid PK), formula_id (uuid FK→formulas), substance_id (uuid FK→substances), quantity (numeric), unit (text), sort_order (integer DEFAULT 0), created_at

4. prescription_protocols — id (uuid PK), name (text NOT NULL), content (text), status (text DEFAULT 'active'), created_by (uuid), created_at, updated_at

5. medications — id (uuid PK), description (text NOT NULL), presentation (text NOT NULL), active_ingredient (text NOT NULL), barcode (text NOT NULL), type (text NOT NULL), label (text NOT NULL), therapeutic_class (text NOT NULL), created_by (uuid), created_at, updated_at

Adicione RLS e policies. Atualize src/types/cadastros.ts com interfaces Substance, Formula, FormulaComposition, PrescriptionProtocol, Medication.
```

---

### Prompt 0.4 — Migration: Tabelas de Modelos de Prontuário e Documentos

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seções 5 e 6) e crie uma migration SQL em database/ chamada create_template_tables.sql.

Crie no schema atendimento:

1. anamnesis_templates — id (uuid PK), title (text NOT NULL), allow_send_on_scheduling (boolean DEFAULT false), created_by (uuid), created_at, updated_at

2. anamnesis_questions — id (uuid PK), template_id (uuid FK→anamnesis_templates ON DELETE CASCADE), question (text NOT NULL), type (text NOT NULL CHECK in: 'text','checkbox','gestational_calculator','multiple_choice'), options (jsonb DEFAULT '[]'), sort_order (integer DEFAULT 0), created_at

3. certificate_templates — id (uuid PK), name (text NOT NULL), content (text NOT NULL), created_by (uuid), created_at, updated_at

4. diet_templates — id, name, content, created_by, created_at, updated_at

5. evolution_templates — id, name, content, created_by, created_at, updated_at

6. exam_templates — id, name, content, created_by, created_at, updated_at

7. exam_categories — id, name (text NOT NULL UNIQUE), sort_order (integer), created_at
   Seed com: Avaliação Cardiológica / Atividade Elétrica, Bioquímica, Fezes, Hematologia, Hormonologia, Imunologia, Marcadores Tumorais, Microbiologia, Pesquisa de Trombofilias, Rotina Básica - Hormonal DBM

8. report_templates — id, name, content, created_by, created_at, updated_at

9. recipe_templates — id, name, content, created_by, created_at, updated_at

10. document_templates — id, title (text NOT NULL), content (text NOT NULL), is_default (boolean DEFAULT false), created_by (uuid), created_at, updated_at

Adicione RLS e policies para todas. Atualize src/types/cadastros.ts com todas as interfaces de templates.
```

---

## FASE 1 — Componentes Compartilhados

### Prompt 1.1 — Componente DataTable Reutilizável

```
Crie um componente reutilizável de DataTable em src/components/cadastros/DataTable.tsx que será usado em TODAS as 15+ telas de listagem do módulo Cadastros.

Requisitos:
- Props: columns (array de {key, label, sortable?, render?}), data (T[]), loading, onSearch, onSort, pagination (page, pageSize, total), onPageChange, actions (array de {icon, label, onClick})
- Campo de busca no topo
- Cabeçalhos clicáveis para sort (com ícone de seta)
- Paginação com select de pageSize (10, 25, 50)
- Coluna de Opções com ícones de ação (eye, pencil, menu dots)
- Badge de Status (colorido: verde=ativo, vermelho=inativo)
- Loading skeleton enquanto carrega
- Empty state "Nenhum item cadastrado"
- Use o design system existente do projeto: Tailwind CSS com o tema teal do módulo atendimento
- Consulte src/config/modules.ts para as cores do tema

Exemplo de uso:
<DataTable
  columns={[{key:'name', label:'Nome', sortable:true}, {key:'status', label:'Status'}]}
  data={collaborators}
  loading={isLoading}
  actions={[{icon:'eye', onClick:handleView}, {icon:'edit', onClick:handleEdit}]}
/>
```

---

### Prompt 1.2 — Rich Text Editor Component

```
Crie um componente de Rich Text Editor em src/components/cadastros/RichTextEditor.tsx usando a biblioteca TipTap (ou similar compatível com React 19).

Requisitos:
- Toolbar com: fonte, bold, italic, underline, highlight, strikethrough, cor do texto, alinhamento (4 opções), tamanho da fonte, tabela, undo/redo, headings
- Versão "extended" com botões adicionais de imagem e link (prop extended={true})
- Prop value/onChange para controle externo (React Hook Form compatible)
- Prop placeholder
- Suporte a variáveis de template: prop variables (array de {key, label, description}) que mostra dropdown para inserir {PACIENTE}, {CPF}, etc.
- Output em HTML
- Estilização consistente com Tailwind/tema teal

Instale as dependências necessárias via npm. Use @tiptap/react, @tiptap/starter-kit e extensões necessárias.
```

---

### Prompt 1.3 — Componentes de Formulário Compartilhados

```
Crie os seguintes componentes reutilizáveis em src/components/cadastros/shared/:

1. MaskedInput.tsx — Input com máscara para CPF (999.999.999-99), Telefone ((99) 9999-9999), Celular ((99) 99999-9999), CEP (99999-999). Use react-input-mask ou implemente com regex. Props: mask, value, onChange, label, error, required.

2. AddressCepLookup.tsx — Grupo de campos de endereço que auto-preenche via API ViaCEP quando o CEP é preenchido (fetch https://viacep.com.br/ws/{cep}/json/). Campos: CEP, Logradouro, Estado (UF select), Cidade, Bairro, Número, Complemento. Props: value (AddressData), onChange.

3. ModalForm.tsx — Modal reutilizável para CRUD simples (Parceiros, Substâncias, Medicamentos). Props: isOpen, onClose, title, children (form fields), onSubmit, loading. Use o padrão de modal existente no projeto ou crie com Tailwind (backdrop + centered card).

4. SidePanelSelector.tsx — Painel lateral para busca e seleção de itens (usado em Protocolos, Exames, Receitas). Props: tabs (array de {key, label}), subTabs (array), items (array de {id, name}), onSelect, searchable. Layout: tabs no topo, busca, lista scrollável de itens clicáveis.

5. QuestionnaireBuilder.tsx — Builder de questionário para Anamneses. Props: questions (array), onAdd, onRemove, onReorder. Cada pergunta tem: texto, tipo (select: Texto, Caixa de seleção, Calculadora gestacional, Múltipla escolha). Drag-and-drop para reordenar.

Todos devem usar React Hook Form integration e seguir o tema teal do módulo atendimento.
```

---

## FASE 2 — Cadastros Gerais (P0/P1)

### Prompt 2.1 — Tela de Profissionais (Listagem + CRUD)

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seção 2.2) e o arquivo src/types/cadastros.ts.

Crie a tela de Profissionais em src/app/atendimento/cadastros/profissionais/:
- page.tsx — Listagem usando DataTable com colunas: Nome, Status, Opções
- criar/page.tsx — Formulário de criação multi-seção
- [id]/page.tsx — Formulário de edição (mesma estrutura, pré-populado)

O formulário deve ter as seções:
1. INFORMAÇÕES BÁSICAS: Nome*, Sexo, Data nascimento, Estado civil, CPF*, RG
2. ENDEREÇO E LOCALIZAÇÃO: usar componente AddressCepLookup
3. INFORMAÇÕES DE CONTATO: Email*, Telefone, Celular, WhatsApp (usar MaskedInput)
4. INFORMAÇÕES PROFISSIONAIS: Tipo profissional* (15 opções do PRD), Especialidade, Estado registro*, Tipo registro* (11 opções do PRD), Registro profissional*, Listagem agendamentos*, Admin*, Checkboxes (Restringir preços, Possui agenda, Restringir agenda)
5. INFORMAÇÕES COMPLEMENTARES: Anexos (drag-drop), Observações

Crie hook src/hooks/useProfessionals.ts com:
- listProfessionals(search, page, pageSize, sort)
- getProfessional(id)
- createProfessional(data)
- updateProfessional(id, data)
- deleteProfessional(id)

Use createSchemaClient('atendimento') para acessar o Supabase. React Hook Form para validação. Tema teal.
```

---

### Prompt 2.2 — Tela de Colaboradores (Listagem + CRUD)

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seção 2.1) e os componentes já criados em src/components/cadastros/.

Crie a tela de Colaboradores em src/app/atendimento/cadastros/colaboradores/:
- page.tsx — Listagem com DataTable
- criar/page.tsx — Formulário de criação
- [id]/page.tsx — Formulário de edição

O formulário é similar ao de Profissionais mas SEM os campos profissionais extras (tipo profissional, registro, etc.). Seções:
1. INFORMAÇÕES BÁSICAS (Nome*, Sexo, Nascimento, Estado civil, CPF*, RG)
2. ENDEREÇO E LOCALIZAÇÃO (AddressCepLookup)
3. INFORMAÇÕES DE CONTATO (Email*, Telefone, Celular, WhatsApp)
4. INFORMAÇÕES PROFISSIONAIS: Cargo* (5 opções: Administrador da clínica, Auxiliar administrativo, Outro tipo de colaborador, Recepcionista, Vendedor), Listagem agendamentos*, Admin*
5. INFORMAÇÕES COMPLEMENTARES (Anexos, Observações)
6. Checkbox "Enviar informações"

Crie hook src/hooks/useCollaborators.ts com CRUD completo.
Use os mesmos componentes compartilhados (MaskedInput, AddressCepLookup, DataTable).
```

---

### Prompt 2.3 — Tela de Procedimentos (Listagem + CRUD)

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seção 3.1).

Crie em src/app/atendimento/cadastros/procedimentos/:
- page.tsx — Listagem com DataTable. Colunas: Nome, Tipo, Valor (R$), Status. Filtros: toggle "Support Health", multi-select tipo (Consultas, Exames, Injetáveis, Outros), Status. Botão especial "REAJUSTAR PREÇOS" que abre modal com input de percentual e aplica ajuste em lote.
- criar/page.tsx — Formulário: Nome*, Tipo de procedimento* (select 4 opções), Duração em minutos*, Toggle "Habilitar composição" (se ativo, mostra builder de composição), Valor de honorários*, Valor total (calculado).
- [id]/page.tsx — Edição

Crie hook src/hooks/useProcedures.ts com CRUD + função adjustPrices(percentage).
```

---

## FASE 3 — Receituário (P2)

### Prompt 3.1 — Substâncias e Medicamentos (Modal CRUD)

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seções 4.1 e 4.4).

Crie em src/app/atendimento/cadastros/receituario/:

1. substancias/page.tsx — Listagem de substâncias (coluna: Nome apenas). Modal para criar/editar (só campo Nome*). Busca otimizada para 5000+ itens (usar debounce + server-side search).

2. medicamentos/page.tsx — Listagem de medicamentos (colunas: Nome, Apresentação). Modal com 7 campos: Descrição*, Apresentação*, Princípio ativo*, Código de barras*, Tipo* (select), Tarja* (select), Classe terapêutica* (select).

Crie hooks: src/hooks/useSubstances.ts e src/hooks/useMedications.ts.
Use o componente ModalForm para ambos.
```

---

### Prompt 3.2 — Fórmulas (CRUD com Composição)

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seção 4.2).

Crie em src/app/atendimento/cadastros/receituario/formulas/:
- page.tsx — Listagem com DataTable (Nome, Status, Opções incluindo botão copiar)
- criar/page.tsx — Formulário com 3 seções:
  1. INFORMAÇÕES DO COMPOSTO: Nome*, Via de uso*, Forma*, Quantidade*, Unidade*
  2. COMPOSIÇÃO: Select de substância (busca), Quantidade, Unidade, botão ADICIONAR. Tabela de itens adicionados (Item, Status, Quantidade) com botão remover.
  3. DADOS COMPLEMENTARES: Posologia*, Referência, Observações, Status

- [id]/page.tsx — Edição (pré-popular composição)

Crie hook src/hooks/useFormulas.ts com CRUD + gestão de composição (addComposition, removeComposition).
A busca de substâncias deve usar o hook useSubstances existente.
```

---

### Prompt 3.3 — Protocolos de Receituário

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seção 4.3).

Crie em src/app/atendimento/cadastros/receituario/protocolos/:
- page.tsx — Listagem (Nome, Status)
- criar/page.tsx — Layout: coluna esquerda com Nome* + RichTextEditor para Conteúdo. Coluna direita com SidePanelSelector:
  - Tabs: MANIPULADOS / INDUSTRIALIZADO
  - Sub-tabs: FÓRMULAS / PROTOCOLOS / SUBSTÂNCIAS
  - Busca textual
  - Checkbox "Exibir modelos da Support Health"
  - Ao clicar num item, insere referência no editor

- [id]/page.tsx — Edição

Crie hook src/hooks/usePrescriptionProtocols.ts.
Use os componentes RichTextEditor e SidePanelSelector já criados.
```

---

## FASE 4 — Clínico Complementar (P2/P3)

### Prompt 4.1 — Parceiros (Modal CRUD)

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seção 3.3).

Crie em src/app/atendimento/cadastros/parceiros/page.tsx:
- Listagem com DataTable (Nome com dot colorido, Status)
- ModalForm para criar/editar: Nome*, Email*, Telefone, WhatsApp, Observações

Crie hook src/hooks/usePartners.ts com CRUD.
```

---

### Prompt 4.2 — Protocolos Clínicos (CRUD com Seleção de Procedimentos)

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seção 3.2).

Crie em src/app/atendimento/cadastros/protocolos/:
- page.tsx — Listagem (Nome, Valor, Status)
- criar/page.tsx — Layout: coluna esquerda com Nome* + Descrição + lista de procedimentos adicionados. Coluna direita com SidePanelSelector:
  - Tabs: INJETÁVEIS / OUTROS (filtrado por procedure_type)
  - Sub-categorias
  - Busca
  - Ao clicar, adiciona procedimento à lista esquerda
  - Valor total calculado automaticamente

- [id]/page.tsx — Edição

Crie hook src/hooks/useClinicalProtocols.ts. Use useProcedures para buscar procedimentos disponíveis.
```

---

## FASE 5 — Modelos de Prontuário (P1/P2)

### Prompt 5.1 — Modelos de Anamnese (Questionário Builder)

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seção 5.1).

Crie em src/app/atendimento/cadastros/modelos/anamneses/:
- page.tsx — Listagem padrão (Título, Responsável, Data). Toggle "Meus modelos".
- criar/page.tsx — Formulário DIFERENTE dos demais:
  - Título*
  - Toggle "Permitir Envio ao Realizar Agendamento"
  - Seção PERGUNTAS: input Pergunta* + select Tipo (Texto, Caixa de seleção, Calculadora gestacional, Múltipla escolha) + botão ADICIONAR
  - Seção QUESTIONÁRIO: lista das perguntas adicionadas, drag-and-drop para reordenar, botão remover em cada
  - Botão SALVAR INFORMAÇÕES

- [id]/page.tsx — Edição

Crie hook src/hooks/useAnamnesisTemplates.ts com CRUD + gestão de perguntas.
Use o componente QuestionnaireBuilder.
```

---

### Prompt 5.2 — Modelos com Editor + Variáveis (Atestados, Dietas, Laudos)

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seções 5.2, 5.3, 5.6).

Esses 3 tipos de modelo compartilham a mesma estrutura: Nome* + Variáveis (dropdown) + Rich Text Editor.

Crie um componente genérico src/components/cadastros/TemplateEditorPage.tsx que recebe:
- templateType: 'certificate' | 'diet' | 'report'
- hookInstance (CRUD functions)
- pageTitle

Depois crie as 3 telas usando esse componente:
1. src/app/atendimento/cadastros/modelos/atestados/ (page.tsx, criar/page.tsx, [id]/page.tsx)
2. src/app/atendimento/cadastros/modelos/dietas/ (page.tsx, criar/page.tsx, [id]/page.tsx)
3. src/app/atendimento/cadastros/modelos/laudos/ (page.tsx, criar/page.tsx, [id]/page.tsx)

Variáveis disponíveis no dropdown (inserem no editor ao clicar):
- {PACIENTE} — Nome completo do paciente
- {CPF} — CPF do paciente
- {NASCIMENTO} — Data nascimento
- {RG} — RG do paciente
- {IDADE} — Idade do paciente
- {ENDEREÇO_PACIENTE} — Endereço
- {DATA} — Data atual

Crie hooks: useCertificateTemplates.ts, useDietTemplates.ts, useReportTemplates.ts (todos com CRUD padrão).
```

---

### Prompt 5.3 — Modelo de Evolução (Editor Estendido)

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seção 5.4).

Crie em src/app/atendimento/cadastros/modelos/evolucao/:
- page.tsx — Listagem padrão
- criar/page.tsx — Nome* + RichTextEditor com extended={true} (inclui imagem e link na toolbar)
- [id]/page.tsx — Edição

Crie hook src/hooks/useEvolutionTemplates.ts.
SEM variáveis neste tipo — apenas Nome + Editor estendido.
```

---

### Prompt 5.4 — Modelo de Exames (Editor + Painel de Categorias)

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seção 5.5).

Crie em src/app/atendimento/cadastros/modelos/exames/:
- page.tsx — Listagem padrão
- criar/page.tsx — Layout 2 colunas:
  - Esquerda: Nome* + RichTextEditor para Conteúdo*
  - Direita: Painel "Tipos de pedidos" com busca + toggle "Meus modelos" + lista de categorias clicáveis:
    1. Avaliação Cardiológica / Atividade Elétrica
    2. Bioquímica
    3. Fezes
    4. Hematologia
    5. Hormonologia
    6. Imunologia
    7. Marcadores Tumorais
    8. Microbiologia
    9. Pesquisa de Trombofilias
    10. Rotina Básica - Hormonal DBM
  Ao clicar numa categoria, insere nome no editor ou expande sub-itens.

- [id]/page.tsx — Edição

Crie hook src/hooks/useExamTemplates.ts. Use a tabela exam_categories para as categorias.
```

---

### Prompt 5.5 — Modelo de Receitas (Editor + Painel Receituário)

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seção 5.7).

Crie em src/app/atendimento/cadastros/modelos/receitas/:
- page.tsx — Listagem padrão
- criar/page.tsx — Layout 2 colunas:
  - Esquerda: Nome* + RichTextEditor para Conteúdo*
  - Direita: SidePanelSelector (mesmo do Prompt 3.3) com tabs MANIPULADOS/INDUSTRIALIZADO, sub-tabs FÓRMULAS/PROTOCOLOS/SUBSTÂNCIAS

- [id]/page.tsx — Edição

Crie hook src/hooks/useRecipeTemplates.ts.
Reutilize o SidePanelSelector do módulo de receituário.
```

---

### Prompt 5.6 — Modelos de Documentos (Termos)

```
Leia PRD_CADASTROS_SUPPORT_CLINIC.md (seção 6).

Crie em src/app/atendimento/cadastros/documentos/:
- page.tsx — Listagem (Título, Opções)
- criar/page.tsx — Título* + Variáveis (dropdown, mesmas 7 variáveis de Atestados) + toggle "Definir como padrão" + RichTextEditor para Conteúdo*
- [id]/page.tsx — Edição

Crie hook src/hooks/useDocumentTemplates.ts.
Lógica especial: quando "Definir como padrão" é ativado, desativar o padrão anterior (UPDATE document_templates SET is_default = false WHERE is_default = true AND id != current_id).
```

---

## FASE 6 — Navegação e Layout

### Prompt 6.1 — Layout de Cadastros com Sidebar

```
Crie o layout de navegação do módulo Cadastros em src/app/atendimento/cadastros/layout.tsx.

Sidebar esquerda com a estrutura de menu do PRD (seção 1.1):
- Cadastros Gerais (colapsível)
  - Colaboradores → /atendimento/cadastros/colaboradores
  - Profissionais → /atendimento/cadastros/profissionais
- Clínico (colapsível)
  - Procedimentos → /atendimento/cadastros/procedimentos
  - Protocolos → /atendimento/cadastros/protocolos
  - Parceiros → /atendimento/cadastros/parceiros
- Receituário (colapsível)
  - Substâncias → /atendimento/cadastros/receituario/substancias
  - Fórmulas → /atendimento/cadastros/receituario/formulas
  - Protocolos → /atendimento/cadastros/receituario/protocolos
  - Medicamentos → /atendimento/cadastros/receituario/medicamentos
- Modelos de Prontuário (colapsível)
  - Anamneses → /atendimento/cadastros/modelos/anamneses
  - Atestados → /atendimento/cadastros/modelos/atestados
  - Dietas → /atendimento/cadastros/modelos/dietas
  - Evolução → /atendimento/cadastros/modelos/evolucao
  - Exames → /atendimento/cadastros/modelos/exames
  - Laudos → /atendimento/cadastros/modelos/laudos
  - Receitas → /atendimento/cadastros/modelos/receitas
- Modelos de Documentos → /atendimento/cadastros/documentos

Use ícones Lucide React. Item ativo destacado com a cor teal do módulo. Sidebar colapsível em mobile.
Adicione "Cadastros" ao header de navegação do módulo atendimento (ao lado de Agenda, Pacientes, etc.).
```

---

## FASE 7 — Polimento e Integração

### Prompt 7.1 — Conectar Profissionais com Agenda

```
Conecte a tabela professionals com a tabela doctors existente no schema atendimento.

Opção A (recomendada): Adicione uma coluna professional_id (uuid FK→professionals) na tabela doctors. Crie uma migration para isso.

Opção B: Se doctors já contém os dados necessários, crie uma VIEW que unifica doctors + professionals.

Atualize o hook de Agenda para buscar profissionais da nova tabela quando "Possui agenda" = true.
Atualize o dropdown de profissionais no modal de agendamento para usar useProfessionals.
```

---

### Prompt 7.2 — Conectar Modelos com Prontuário

```
Atualize as telas de prontuário existentes em src/components/medical-record/ para usar os modelos de template cadastrados:

1. Na tab de Anamnese: buscar modelos de anamnesis_templates e renderizar o questionário
2. Na tab de Evolução: oferecer dropdown para selecionar evolution_template e pré-preencher o editor
3. Na tab de Atestados: oferecer dropdown para selecionar certificate_template
4. Na tab de Laudos: oferecer dropdown para selecionar report_template
5. Na tab de Receitas: oferecer dropdown para selecionar recipe_template
6. Na tab de Exames: oferecer dropdown para selecionar exam_template

Em todos os casos:
- Ao selecionar um template, preencher o editor com o conteúdo
- Substituir variáveis ({PACIENTE}, {CPF}, etc.) pelos dados reais do paciente atual
- Permitir edição após inserção do template
```

---

### Prompt 7.3 — Review TypeScript e Testes

```
Faça uma revisão completa do módulo de Cadastros:

1. Verifique que todos os tipos em src/types/cadastros.ts estão corretos e completos
2. Verifique que todos os hooks fazem tratamento de erro adequado (try/catch + toast)
3. Verifique que todas as telas têm loading states e empty states
4. Verifique que a navegação funciona corretamente entre todas as rotas
5. Rode npx tsc --noEmit para verificar erros de TypeScript
6. Verifique que as migrations SQL estão corretas (constraints, FKs, RLS)

Corrija quaisquer erros encontrados.
```

---

## Resumo dos Prompts

| # | Prompt | Fase | Prioridade |
|---|--------|------|------------|
| 0.1 | Migration: Cadastros Gerais | DB | P0 |
| 0.2 | Migration: Clínico | DB | P0 |
| 0.3 | Migration: Receituário | DB | P2 |
| 0.4 | Migration: Templates | DB | P1 |
| 1.1 | DataTable component | Infra | P0 |
| 1.2 | Rich Text Editor | Infra | P1 |
| 1.3 | Componentes compartilhados | Infra | P0 |
| 2.1 | Profissionais CRUD | UI | P0 |
| 2.2 | Colaboradores CRUD | UI | P1 |
| 2.3 | Procedimentos CRUD | UI | P0 |
| 3.1 | Substâncias + Medicamentos | UI | P2 |
| 3.2 | Fórmulas CRUD | UI | P2 |
| 3.3 | Protocolos Receituário | UI | P3 |
| 4.1 | Parceiros CRUD | UI | P2 |
| 4.2 | Protocolos Clínicos | UI | P3 |
| 5.1 | Modelos Anamnese | UI | P1 |
| 5.2 | Modelos Atestados/Dietas/Laudos | UI | P2 |
| 5.3 | Modelos Evolução | UI | P1 |
| 5.4 | Modelos Exames | UI | P3 |
| 5.5 | Modelos Receitas | UI | P3 |
| 5.6 | Modelos Documentos | UI | P3 |
| 6.1 | Layout + Navegação | UI | P0 |
| 7.1 | Integrar Profissionais↔Agenda | Int | P0 |
| 7.2 | Integrar Templates↔Prontuário | Int | P1 |
| 7.3 | Review TypeScript | QA | — |

**Total: 25 prompts em 8 fases**
