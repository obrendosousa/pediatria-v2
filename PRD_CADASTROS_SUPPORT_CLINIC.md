# PRD — Módulo de Cadastros (Support Clinic v2.13.68)

> Documento de referência para implementar o módulo de Cadastros no sistema Painel Clínica (módulo Atendimento).
> Mapeamento completo realizado em 13/03/2026 via navegação direta no Support Clinic.

---

## 1. Visão Geral

O módulo **Cadastros** é acessado pelo menu principal (`/cadastros`) e contém toda a configuração de dados mestres da clínica: profissionais, colaboradores, procedimentos, receituário e modelos de prontuário/documentos.

### 1.1 Estrutura do Menu Lateral

```
Cadastros
├── Cadastros Gerais
│   ├── Colaboradores    → /humanos/colaboradores
│   └── Profissionais    → /humanos/profissionais
├── Clínico
│   ├── Procedimentos    → /clinico/tratamentos
│   ├── Protocolos       → /clinico/protocolos
│   └── Parceiros        → /clinico/parceiros
├── Receituário
│   ├── Substâncias      → /laboratorio/substancias
│   ├── Fórmulas         → /laboratorio/formulas
│   ├── Protocolos       → /laboratorio/protocolos
│   └── Medicamentos     → /laboratorio/industrializados
├── Modelos de Prontuário
│   ├── Anamneses        → /clinico/modelos/anamneses
│   ├── Atestados        → /clinico/modelos/atestados
│   ├── Dietas           → /clinico/modelos/dietas
│   ├── Evolução         → /clinico/modelos/evolucao
│   ├── Exames           → /clinico/modelos/exames
│   ├── Laudos           → /clinico/modelos/laudos
│   └── Receitas         → /clinico/modelos/receitas
└── Modelos de Documentos → /administracao/termos
```

---

## 2. Cadastros Gerais

### 2.1 Colaboradores

**URL Listagem:** `/humanos/colaboradores`
**URL Criação:** `/humanos/colaboradores/criar`

#### Listagem
| Coluna | Tipo |
|--------|------|
| Nome | text |
| Status | badge (ATIVO/INATIVO) |
| Opções | ícones: visualizar (olho), editar (lápis), menu (...) |

- Pesquisa por texto
- Paginação (10 por página)
- 12 colaboradores no sistema de referência

#### Formulário de Criação/Edição

**INFORMAÇÕES BÁSICAS:**
| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Nome | text | Sim* |
| Sexo | select | Não |
| Data de nascimento | date | Não |
| Estado civil | select | Não |
| CPF | text (mask) | Sim* |
| RG | text | Não |

**ENDEREÇO E LOCALIZAÇÃO:**
| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Logradouro | text | Não |
| CEP | text (mask) | Não |
| Estado | select (UF) | Não |
| Cidade | select | Não |
| Bairro | text | Não |
| Número | text | Não |
| Complemento | text | Não |

**INFORMAÇÕES DE CONTATO:**
| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| E-mail | email | Sim* |
| Telefone | text (mask) | Não |
| Celular | text (mask) | Não |
| WhatsApp | text (mask) | Não |

**INFORMAÇÕES PROFISSIONAIS:**
| Campo | Tipo | Obrigatório | Opções |
|-------|------|-------------|--------|
| Cargo | select | Sim* | Administrador da clínica, Auxiliar administrativo, Outro tipo de colaborador, Recepcionista, Vendedor |
| Listagem dos agendamentos | select | Sim* | Visualizar agendamento, Abrir prontuário |
| Acesso de administrador | radio | Sim* | Sim, Não |

**INFORMAÇÕES COMPLEMENTARES:**
| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Anexos | drag-drop file upload | Não |
| Observações | textarea | Não |

**Checkbox adicional:** "Enviar informações" (enviar convite por e-mail)

---

### 2.2 Profissionais

**URL Listagem:** `/humanos/profissionais`
**URL Criação:** `/humanos/profissionais/criar`

#### Listagem
Mesma estrutura de Colaboradores (Nome, Status, Opções). 14 profissionais no sistema de referência.

#### Formulário de Criação/Edição

Herda TODOS os campos de Colaboradores (seções: Informações Básicas, Endereço, Contato, Complementares) MAIS campos adicionais na seção Informações Profissionais:

**INFORMAÇÕES PROFISSIONAIS (campos adicionais):**
| Campo | Tipo | Obrigatório | Opções |
|-------|------|-------------|--------|
| Tipo de profissional | select | Sim* | Biomédico, Educador físico, Enfermeiro(a), Esteticista, Farmacêutico, Fisioterapeuta, Fonoaudiólogo, Médico(a), Nutricionista, Odontólogo, Outros, Profissional externo, Psicólogo, Técnico em enfermagem, Terapeuta |
| Especialidade | select | Não | (dinâmico conforme tipo) |
| Estado de registro | select | Sim* | UF (todos os estados brasileiros) |
| Tipo de registro | select | Sim* | CRBM, COREN, CRF, CREFITO, CREFONO/CRFa, CRM, CRN, CRO, CRP, Outros (O), Reg.Col.Med |
| Registro profissional | text | Sim* | (número do registro) |
| Listagem dos agendamentos | select | Sim* | Visualizar agendamento, Abrir prontuário |
| Acesso de administrador | radio | Sim* | Sim, Não |

**Checkboxes adicionais (Profissionais):**
| Campo | Tipo | Default |
|-------|------|---------|
| Restringir preços | checkbox | Não |
| Possui agenda | checkbox | Não |
| Restringir agenda | checkbox | Não |

---

## 3. Clínico

### 3.1 Procedimentos

**URL Listagem:** `/clinico/tratamentos`
**URL Criação:** `/clinico/tratamentos/criar`

#### Listagem
| Coluna | Tipo |
|--------|------|
| Nome | text |
| Tipo | text |
| Valor | currency (R$) |
| Status | badge (Ativo/Inativo) |
| Opções | ícones padrão |

**Filtros:**
- Toggle "Support Health" (mostra procedimentos pré-definidos)
- Tipo de procedimento (multi-select): Consultas, Exames, Injetáveis, Outros
- Status: Ativo/Inativo

**Botão especial:** REAJUSTAR PREÇOS (ajuste percentual em lote)

#### Formulário de Criação/Edição

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Nome | text | Sim* |
| Tipo de procedimento | select | Sim* |
| Duração (em minutos) | number | Sim* |

**Composição do procedimento:**
- Toggle "Habilitar composição" (permite compor procedimento com sub-itens)

**PRECIFICAÇÃO DO PROCEDIMENTO:**
| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Valor de honorários | currency | Sim* |
| Valor total | currency (calculado) | — |

**Tipos de procedimento disponíveis:**
- Consultas
- Exames
- Injetáveis
- Outros

---

### 3.2 Protocolos (Clínico)

**URL Listagem:** `/clinico/protocolos`
**URL Criação:** `/clinico/protocolos/criar`

#### Listagem
| Coluna | Tipo |
|--------|------|
| Nome | text |
| Valor | currency |
| Status | badge |

#### Formulário de Criação/Edição

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Nome | text | Sim* |
| Descrição | textarea | Não |

**Itens do protocolo:**
- Painel à esquerda: lista de procedimentos adicionados
- Painel à direita: busca e seleção de procedimentos
  - Tabs: INJETÁVEIS / OUTROS
  - Sub-categorias por tipo
  - Busca textual

---

### 3.3 Parceiros

**URL:** `/clinico/parceiros`

#### Listagem
| Coluna | Tipo |
|--------|------|
| Nome | text (com dot colorido) |
| Status | badge |
| Opções | ícones padrão |

3 parceiros no sistema de referência.

#### Formulário (Modal)

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Nome | text | Sim* |
| E-mail | email | Sim* |
| Telefone | text (mask) | Não |
| WhatsApp | text (mask) | Não |
| Observações | textarea | Não |

---

## 4. Receituário

### 4.1 Substâncias

**URL:** `/laboratorio/substancias`

#### Listagem
| Coluna | Tipo |
|--------|------|
| Nome | text |

- 4.967 itens no sistema de referência
- Pesquisa por texto
- Paginação

#### Formulário (Modal)

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Nome | text | Sim* |

---

### 4.2 Fórmulas

**URL Listagem:** `/laboratorio/formulas`
**URL Criação:** `/laboratorio/formulas/criar`

#### Listagem
| Coluna | Tipo |
|--------|------|
| Nome | text |
| Status | badge |
| Opções | visualizar, editar, copiar |

2 fórmulas no sistema de referência.

#### Formulário de Criação/Edição

**INFORMAÇÕES DO COMPOSTO:**
| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Nome da fórmula | text | Sim* |
| Via de uso | select | Sim* |
| Forma | select | Sim* |
| Quantidade | number | Sim* |
| Unidade | select | Sim* |

**COMPOSIÇÃO:**
| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Substância | select (busca) | — |
| Quantidade | number | — |
| Unidade | select | — |
| Botão ADICIONAR | — | — |

Tabela de composição: Item, Status, Quantidade

**DADOS COMPLEMENTARES:**
| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Posologia | text | Sim* |
| Referência | text | Não |
| Observações | textarea | Não |
| Status | select | Não |

---

### 4.3 Protocolos (Receituário)

**URL Listagem:** `/laboratorio/protocolos`
**URL Criação:** `/laboratorio/protocolos/criar`

#### Listagem
| Coluna | Tipo |
|--------|------|
| Nome | text |
| Status | badge |

#### Formulário de Criação/Edição

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Nome | text | Sim* |
| Conteúdo | Rich Text Editor (WYSIWYG completo) | Não |

**Painel lateral direito:**
- Tabs: MANIPULADOS / INDUSTRIALIZADO
- Sub-tabs: FÓRMULAS / PROTOCOLOS / SUBSTÂNCIAS
- Busca textual
- Checkbox "Exibir modelos da Support Health"
- Itens clicáveis para inserir no conteúdo

---

### 4.4 Medicamentos (Industrializados)

**URL:** `/laboratorio/industrializados`

#### Listagem
| Coluna | Tipo |
|--------|------|
| Nome | text |
| Apresentação | text |
| Opções | ícones padrão |

#### Formulário (Modal)

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Descrição | text | Sim* |
| Apresentação | text | Sim* |
| Princípio ativo | text | Sim* |
| Código de barras | text | Sim* |
| Tipo | select | Sim* |
| Tarja | select | Sim* |
| Classe terapêutica | select | Sim* |

---

## 5. Modelos de Prontuário

Todos os 7 tipos de modelo compartilham a mesma estrutura de listagem:

### 5.0 Padrão de Listagem (Todos os Modelos)

| Coluna | Tipo |
|--------|------|
| Nome/Título | text |
| Responsável | text |
| Data | datetime |
| Opções | visualizar, editar, menu (...) |

- Toggle "Meus modelos" (filtra por autor)
- Botão "ADICIONAR MODELO"
- Pesquisa textual
- Paginação (10 por página)

### 5.1 Anamneses

**URL Listagem:** `/clinico/modelos/anamneses`
**URL Criação:** `/clinico/modelos/anamneses/criar`

**5 modelos pré-existentes:** Anamnese enfermagem, Anamnese integrativa, Anamnese primeira consulta, Pré-consulta fisiologia hormonal, Pré-consulta qualidade de vida (WHO QOL) OMS

#### Formulário — DIFERENTE dos demais!

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Título | text | Sim* |
| Permitir Envio ao Realizar Agendamento | toggle | Não |

**Seção PERGUNTAS:**
| Campo | Tipo |
|-------|------|
| Pergunta | text* |
| Tipo | select |
| Botão ADICIONAR | — |

**Tipos de pergunta disponíveis:**
- Texto
- Caixa de seleção
- Calculadora gestacional
- Múltipla escolha

**Seção QUESTIONÁRIO:** Tabela com as perguntas adicionadas (reordenável)

**Botão:** SALVAR INFORMAÇÕES

---

### 5.2 Atestados

**URL Listagem:** `/clinico/modelos/atestados`
**URL Criação:** `/clinico/modelos/atestados/criar`

**3 modelos pré-existentes:** Atestado de afastamento, Declaração de comparecimento em horas, Falta ao Trabalho por Isolamento Domiciliar Devido ao COVID 19

#### Formulário (Padrão "Nome + Variáveis + Editor")

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Nome | text | Sim* |
| Variáveis | dropdown (inserção) | Não |
| Descrição | Rich Text Editor (WYSIWYG) | Sim* |

**Variáveis disponíveis:**
| Variável | Descrição |
|----------|-----------|
| {PACIENTE} | Nome completo do paciente |
| {CPF} | CPF do paciente |
| {NASCIMENTO} | Data nascimento do paciente |
| {RG} | RG do paciente |
| {IDADE} | Idade do paciente |
| {ENDEREÇO_PACIENTE} | Endereço do paciente |
| {DATA} | Data atual |

---

### 5.3 Dietas

**URL Listagem:** `/clinico/modelos/dietas`
**URL Criação:** `/clinico/modelos/dietas/criar`

#### Formulário
Mesmo padrão de Atestados: Nome* + Variáveis + Rich Text Editor

---

### 5.4 Evolução

**URL Listagem:** `/clinico/modelos/evolucao`
**URL Criação:** `/clinico/modelos/evolucao/criar`

**3 modelos pré-existentes:** Evolução de enfermagem, Exame físico, Últimos diagnósticos

#### Formulário

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Nome | text | Sim* |
| Descrição | Rich Text Editor (WYSIWYG estendido — com imagem e link) | Sim* |

> **Nota:** O editor de Evolução possui toolbar mais completa que os demais, incluindo botões de imagem e link.

---

### 5.5 Exames

**URL Listagem:** `/clinico/modelos/exames`
**URL Criação:** `/clinico/modelos/exames/criar`

#### Formulário — DIFERENTE (com painel de categorias)

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Nome | text | Sim* |
| Conteúdo | Rich Text Editor (WYSIWYG) | Sim* |

**Painel lateral: "Tipos de pedidos"**
- Busca textual
- Toggle "Meus modelos"
- Categorias de exames (clicáveis):
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

---

### 5.6 Laudos

**URL Listagem:** `/clinico/modelos/laudos`
**URL Criação:** `/clinico/modelos/laudos/criar`

#### Formulário
Mesmo padrão de Atestados: Nome* + Variáveis + Descrição* (Rich Text Editor)

---

### 5.7 Receitas

**URL Listagem:** `/clinico/modelos/receitas`
**URL Criação:** `/clinico/modelos/receitas/criar`

#### Formulário — com painel de receituário

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Nome | text | Sim* |
| Conteúdo | Rich Text Editor (WYSIWYG) | Sim* |

**Painel lateral (mesmo do Receituário > Protocolos):**
- Tabs: MANIPULADOS / INDUSTRIALIZADO
- Sub-tabs: FÓRMULAS / PROTOCOLOS / SUBSTÂNCIAS
- Busca textual
- Checkbox "Exibir modelos da Support Health"
- Clique para inserir item no editor

---

## 6. Modelos de Documentos

**URL Listagem:** `/administracao/termos`
**URL Criação:** `/administracao/termos/criar`

#### Listagem
| Coluna | Tipo |
|--------|------|
| Título | text |
| Opções | visualizar, editar, menu (...) |

1 documento no sistema de referência: "Termo de consentimento"

#### Formulário de Criação/Edição

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Título | text | Sim* |
| Variáveis | dropdown (inserção) | Não |
| Definir como padrão | toggle | Não |
| Conteúdo | Rich Text Editor (WYSIWYG) | Sim* |

> Variáveis: mesmas disponíveis em Atestados ({PACIENTE}, {CPF}, {NASCIMENTO}, {RG}, {IDADE}, {ENDEREÇO_PACIENTE}, {DATA})

---

## 7. Padrões de UX Observados

### 7.1 Componentes Reutilizáveis

1. **Listagem padrão:** Tabela com pesquisa, paginação, colunas sortable, ações (visualizar/editar/menu)
2. **Rich Text Editor (WYSIWYG):** Usado em 9+ telas. Toolbar: fonte, B, I, U, realce, strikethrough, cor, alinhamento, listas, tamanho, cor texto, tabela, undo/redo, heading. Versão estendida inclui imagem e link.
3. **Formulário multi-seção:** Grupos colapsíveis com títulos em uppercase (INFORMAÇÕES BÁSICAS, etc.)
4. **Modal form:** Para entidades simples (Parceiros, Substâncias, Medicamentos)
5. **Painel lateral de seleção:** Usado em Protocolos, Exames e Receitas para buscar e inserir itens
6. **Variáveis de template:** Dropdown que insere placeholders no editor ({PACIENTE}, {CPF}, etc.)
7. **Toggle "Meus modelos":** Filtra modelos criados pelo usuário logado

### 7.2 Padrões de Formulário

- Campos obrigatórios marcados com asterisco (*)
- Botão principal: "SALVAR INFORMAÇÕES" (azul, canto inferior direito)
- Validação client-side antes de submit
- Masks aplicados em CPF, telefone, celular, CEP
- CEP com busca automática de endereço (via API ViaCEP ou similar)

### 7.3 Categorização dos Formulários

| Padrão | Telas |
|--------|-------|
| **Form multi-seção completo** | Colaboradores, Profissionais |
| **Form com precificação** | Procedimentos |
| **Form com composição** | Fórmulas, Protocolos (Clínico) |
| **Form Nome + Editor** | Evolução |
| **Form Nome + Variáveis + Editor** | Atestados, Dietas, Laudos, Documentos |
| **Form Nome + Editor + Painel lateral** | Exames, Receitas, Protocolos (Receituário) |
| **Form questionário (dinâmico)** | Anamneses |
| **Modal simples** | Parceiros, Substâncias, Medicamentos |

---

## 8. Mapeamento para o Projeto (Atendimento)

### 8.1 Estrutura de Rotas Proposta

```
/atendimento/cadastros
├── /colaboradores         → Listagem + CRUD
├── /profissionais         → Listagem + CRUD
├── /procedimentos         → Listagem + CRUD
├── /protocolos            → Listagem + CRUD
├── /parceiros             → Listagem + CRUD (modal)
├── /receituario
│   ├── /substancias       → Listagem + CRUD (modal)
│   ├── /formulas          → Listagem + CRUD
│   ├── /protocolos        → Listagem + CRUD
│   └── /medicamentos      → Listagem + CRUD (modal)
├── /modelos
│   ├── /anamneses         → Listagem + CRUD (questionário)
│   ├── /atestados         → Listagem + CRUD (editor)
│   ├── /dietas            → Listagem + CRUD (editor)
│   ├── /evolucao          → Listagem + CRUD (editor)
│   ├── /exames            → Listagem + CRUD (editor + painel)
│   ├── /laudos            → Listagem + CRUD (editor)
│   └── /receitas          → Listagem + CRUD (editor + painel)
└── /documentos            → Listagem + CRUD (editor)
```

### 8.2 Tabelas Necessárias no Supabase (schema: atendimento)

```sql
-- Cadastros Gerais
collaborators           -- Colaboradores
professionals           -- Profissionais (extends collaborator fields)

-- Clínico
procedures              -- Procedimentos
procedure_compositions  -- Composição de procedimentos
clinical_protocols      -- Protocolos clínicos
clinical_protocol_items -- Itens dos protocolos
partners                -- Parceiros

-- Receituário
substances              -- Substâncias (4967+ items)
formulas                -- Fórmulas
formula_compositions    -- Composição das fórmulas
prescription_protocols  -- Protocolos de receituário
medications             -- Medicamentos industrializados

-- Modelos de Prontuário
anamnesis_templates     -- Modelos de anamnese
anamnesis_questions     -- Perguntas da anamnese
certificate_templates   -- Modelos de atestados
diet_templates          -- Modelos de dietas
evolution_templates     -- Modelos de evolução
exam_templates          -- Modelos de exames
exam_categories         -- Categorias de exames
report_templates        -- Modelos de laudos
recipe_templates        -- Modelos de receitas

-- Modelos de Documentos
document_templates      -- Modelos de documentos (termos)
```

### 8.3 Priorização Sugerida

| Prioridade | Módulo | Justificativa |
|------------|--------|---------------|
| P0 (Crítico) | Profissionais | Necessário para agenda e prontuário |
| P0 (Crítico) | Procedimentos | Necessário para agendamento |
| P1 (Alto) | Colaboradores | Gestão de equipe |
| P1 (Alto) | Modelos de Evolução | Usado no prontuário diariamente |
| P1 (Alto) | Modelos de Anamnese | Questionários de pré-consulta |
| P2 (Médio) | Substâncias + Fórmulas + Medicamentos | Receituário |
| P2 (Médio) | Modelos de Atestados/Laudos/Dietas | Templates de documentos |
| P2 (Médio) | Parceiros | Referências externas |
| P3 (Baixo) | Protocolos (Clínico + Receituário) | Automação de fluxos |
| P3 (Baixo) | Modelos de Exames/Receitas | Dependem do receituário |
| P3 (Baixo) | Modelos de Documentos | Termos de consentimento |

---

## 9. Componentes Compartilhados a Criar

| Componente | Usado em |
|------------|----------|
| `DataTable` | TODAS as listagens (15+ telas) |
| `RichTextEditor` | 9+ telas de modelos |
| `TemplateVariablesPicker` | Atestados, Dietas, Laudos, Documentos |
| `MultiSectionForm` | Colaboradores, Profissionais |
| `SidePanelSelector` | Protocolos, Exames, Receitas |
| `ModalForm` | Parceiros, Substâncias, Medicamentos |
| `QuestionnaireBuilder` | Anamneses |
| `CompositionBuilder` | Fórmulas, Protocolos Clínicos |
| `AddressCepLookup` | Colaboradores, Profissionais |
| `MaskedInput` | CPF, Telefone, Celular, CEP |

---

## 10. Integração com Módulos Existentes

| Cadastro | Integra com |
|----------|-------------|
| Profissionais | Agenda (doctors), Prontuário (medical_records.doctor_id) |
| Procedimentos | Agenda (appointments.procedure), Financeiro |
| Substâncias/Fórmulas/Medicamentos | Prontuário → Prescrições (prescriptions) |
| Modelos de Anamnese | Prontuário → Tab Anamnese |
| Modelos de Evolução | Prontuário → Tab Evolução |
| Modelos de Atestados | Prontuário → Tab Atestados |
| Modelos de Laudos | Prontuário → Tab Laudos |
| Modelos de Exames | Prontuário → Tab Exames |
| Modelos de Receitas | Prontuário → Tab Receitas |
| Modelos de Documentos | Prontuário → Tab Documentos |
| Parceiros | Prontuário → Encaminhamentos |
