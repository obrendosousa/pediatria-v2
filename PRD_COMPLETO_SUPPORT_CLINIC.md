# PRD — Clone do Sistema Support Clinic v2.13.68
## Product Requirements Document — Sistema de Gestao Clinica (Modulo Atendimento)

---

## 1. VISAO GERAL DO PRODUTO

**Objetivo:** Clonar as funcionalidades do modulo de atendimento clinico do Support Clinic v2.13.68 — cobrindo Pacientes, Prontuario Eletronico, Agenda e Dashboard de Metricas.

**Tenant:** Cada clinica e um tenant (ID da clinica: ex. `22497`). Suporte a multiplos colaboradores e profissionais por clinica.

**Stack inferida do sistema de referencia:** SPA (Single Page Application), API REST, banco relacional (PostgreSQL/MySQL), autenticacao por sessao com CSRF token.

> **IMPORTANTE — Modulo e Schema**
> Todo o banco de dados deste PRD pertence ao **schema `atendimento`** do Supabase (conforme PRD_MULTIMODULO.md).
> Todas as telas serao construidas dentro do **modulo Atendimento** do sistema, sob a rota `/(platform)/atendimento/*`.
> Tabelas referenciadas neste documento (patients, appointments, medical_records, chats, etc.) devem ser lidas como `atendimento.<tabela>`.
> FKs para tabelas compartilhadas (doctors, profiles) apontam para `public.<tabela>`.

---

## 2. NAVEGACAO PRINCIPAL

### 2.1 Header Principal
```
Home | Agenda | Pacientes | Produtos > | Vendas > | Financeiro | Cadastros > | Academy | Support Lab
```

### 2.2 Menu do Usuario (dropdown no avatar)
- ID da clinica: {id}
- Editar perfil → `/configuracoes/perfil`
- Alterar senha → `/configuracoes/perfil#alterar-senha`
- Perfil da clinica → `/configuracoes/perfil/clinica`
- Planos e pagamentos → `/faturas`
- Configuracoes → `/configuracoes/perfil`
- Logins ativos → `/configuracoes/logins`
- Sugestoes → `/sugestoes/trending`
- Indique um amigo → link externo
- Sair → `/logout`

### 2.3 Elementos Globais
- **Notificacoes** (sino no header)
- **Chat interno** (widget flutuante no canto inferior direito) com lista de contatos
- **Pesquisa global** (icone de lupa)
- **Ajuda** (modal com Base de Conhecimento + link WhatsApp analista + ID da Clinica)
- **Versao do sistema** exibida no footer: `Support Clinic versao: 2.13.68`

---

## 3. MODULO: HOME (DASHBOARD)

**URL:** `/home`

### 3.1 Filtros
| Campo | Tipo | Opcoes |
|-------|------|--------|
| Periodo | Select | Hoje, Semana, Mes, etc. |
| Profissional | Select | Lista de profissionais da clinica |
| Botao PESQUISAR | Button | Aplica filtros |

### 3.2 Layout
O dashboard e dividido em:
- **Coluna lateral esquerda:** "Pacientes do dia" — lista dos agendamentos do dia para o profissional selecionado. Mostra "Nao ha agendamentos no dia!" quando vazio.
- **Area principal:** KPIs + Graficos

### 3.3 KPI Cards (4 cards coloridos)
| Card | Cor | Icone | Metrica |
|------|-----|-------|---------|
| Agendamentos | Roxo/Azul | Calendario | Total de agendamentos no periodo |
| Pacientes Confirmados | Azul claro | Pessoa | Agendamentos confirmados |
| Pacientes que Faltaram | Vermelho/Rosa | Pessoas | Pacientes que nao compareceram |
| Pacientes Atendidos | Verde | Balao de chat | Pacientes efetivamente atendidos |

### 3.4 Graficos e Widgets
| Widget | Tipo | Descricao |
|--------|------|-----------|
| Atendimentos por periodo | Grafico de barras | Quantidade de atendimentos ao longo do tempo (eixo X = datas) |
| Atendimentos por convenio | Grafico (colapsavel) | Distribuicao de atendimentos por tipo de convenio |
| Procedimentos realizados | Widget colapsavel | Lista/grafico dos procedimentos realizados no periodo |
| Aniversariantes | Tabela colapsavel | Colunas: Paciente, Data — pacientes aniversariantes no periodo |

**Logica dos widgets:** Cada widget tem botoes de expandir/colapsar (chevron) e fechar (X).

---

## 4. MODULO: PACIENTES

### 4.1 Listagem de Pacientes
**URL:** `/comercial/clientes`

#### 4.1.1 Sidebar do Modulo Pacientes
- Pesquisar paciente (campo de busca)
- Pacientes (link ativo)
- Resumo do paciente → `/atendimento/resumo`

#### 4.1.2 Cabecalho da Listagem
- Titulo: "Todos os pacientes"
- Botao: **ADICIONAR PACIENTE** (azul) → `/comercial/clientes/criar`
- Engrenagem (configuracoes)
- Filtro (funil) com opcoes: Ativo | Inativo | Todos

#### 4.1.3 Barra de Ferramentas
- Campo de busca: `Pesquisar...` (busca por nome/telefone)
- Select de itens por pagina: 10 | 25 | 50

#### 4.1.4 Tabela de Pacientes
| Coluna | Tipo | Ordenavel | Descricao |
|--------|------|-----------|-----------|
| Foto | Imagem | Nao | Avatar do paciente (imagem padrao se nao definido) |
| Paciente | Link + texto | Sim (A-Z / Z-A) | Nome do paciente + telefone abaixo |
| Status | Badge dropdown | Sim | ATIVO (verde) / INATIVO — clicavel para alterar |
| Opcoes | Icones | Nao | Prontuario (link), Visualizar (olho), Menu (...) |

**Menu de opcoes (...):** Opcoes adicionais que expandem via dropdown.

#### 4.1.5 Acoes por Paciente
- **Prontuario** → `/comercial/clientes/{id}/prontuario`
- **Visualizar** → `/comercial/clientes/{id}/visualizar`
- **Editar** → abre modal lateral de edicao

#### 4.1.6 Paginacao
- Texto: "Mostrando resultado X ate Y de Z itens"
- Botoes: Previous | {numero_paginas} | Next

#### 4.1.7 Completar Cadastro (Modal)
Permite gerar link para o paciente completar o cadastro:
- E-mail
- WhatsApp
- Checkbox: Completar cadastro por e-mail
- Checkbox: Completar cadastro por WhatsApp
- Botao: Gerar link

#### 4.1.8 Configurar Formulario (Modal de configuracao)
Permite definir quais campos sao **obrigatorios** no cadastro. Cada campo tem um checkbox "Obrigatorio":
Nome, Nome social, Data de nascimento, Sexo, Estado civil, Nome da mae, Nome do pai, Conjuge, Foto do paciente, CPF, RG, Orgao Expedidor, Estado, Data de Emissao, Telefone, Celular, WhatsApp, Email, Endereco, CEP, Estado, Cidade, Bairro, Numero, Referencia, Complemento, Escolaridade, Profissao, Renda mensal, Necessidades especiais, Nome contato de emergencia, Contato de emergencia, Nome do convenio, Numero da carteirinha, Origem, Nome da origem, Observacoes da origens, Nome do responsavel financeiro, CPF do responsavel financeiro.

---

### 4.2 Formulario de Cadastro/Edicao do Paciente (Modal)

**Organizacao em 8 abas:**

#### ABA 1: Informacoes Basicas (`#basicInformationTab`)
| Campo | Tipo | Obrigatorio | Opcoes/Formato |
|-------|------|-------------|----------------|
| Nome | text | Sim (*) | Texto livre |
| Nome social | text | Nao | Texto livre |
| Data de nascimento | text (date mask) | Nao | DD/MM/AAAA |
| Sexo | select | Nao | Feminino (value=2), Masculino (value=1) |
| Estado civil | select | Nao | Amasiado(a)=6, Casado(a)=2, Divorciado(a)=4, Separado(a)=5, Solteiro(a)=1, Viuvo(a)=3 |
| Nome da mae | text | Nao | Texto livre |
| Nome do pai | text | Nao | Texto livre |
| Conjuge | text | Nao | Texto livre |
| Foto do paciente | file upload | Nao | Upload com crop/zoom |

#### ABA 2: Documentacao e Identidade (`#documentationIdentityTab`)
| Campo | Tipo | Opcoes/Formato |
|-------|------|----------------|
| CPF | text (mask) | 000.000.000-00 |
| RG | text | Texto livre |
| Paciente estrangeiro | checkbox | Sim/Nao |
| Orgao Expedidor | select | 20 opcoes (SSP, PC, PM, CNT, CTPS, DIC, FGTS, IFP, IML, IPF, MAE, MEX, MMA, MTE, POF, POM, SES, SJS, SJTS, ZZZ) |
| Estado (do RG) | select | 27 estados brasileiros |
| Data de Emissao | text (date mask) | DD/MM/AAAA |

#### ABA 3: Informacoes de Contato (`#contactInformationTab`)
| Campo | Tipo | Formato |
|-------|------|---------|
| Telefone | text (mask) | (00) 0000-0000 |
| Celular | text (mask) | (00) 00000-0000 |
| WhatsApp | text (mask) | (00) 00000-0000 |
| E-mail | email | email@example.com |

#### ABA 4: Endereco e Localizacao (`#addressLocationTab`)
| Campo | Tipo | Observacao |
|-------|------|------------|
| CEP | text (mask) | 00000-000 — auto-preenche endereco |
| Endereco | text | Texto livre |
| Estado | select | 27 estados brasileiros |
| Cidade | select (searchable) | Dinamico — carrega cidades do estado selecionado |
| Bairro | text | Texto livre |
| Numero | text | Texto livre |
| Referencia | text | Texto livre |
| Complemento | text | Texto livre |

**Logica:** Ao digitar o CEP, o sistema busca automaticamente (via API de CEP — ex: ViaCEP) e preenche Endereco, Estado, Cidade e Bairro.

#### ABA 5: Informacoes Complementares (`#additionalInformationTab`)
| Campo | Tipo | Opcoes |
|-------|------|--------|
| Escolaridade | select | Analfabeto=1, Fundamental completo=3, Fundamental incompleto=2, Medio completo=5, Medio incompleto=4, Pos-graduado doutorado=12, Pos-graduado especializacao=10, Pos-graduado mestrado=11, Superior completo=9, Superior incompleto=8, Tecnico completo=7, Tecnico incompleto=6 |
| Profissao | text | Texto livre |
| Renda mensal | select | ate R$ 1.000=1, R$ 1.000-3.000=2, R$ 3.000-5.000=3, R$ 5.000-7.000=4, R$ 7.000-15.000=5, R$ 15.000-20.000=7, acima R$ 20.000=8, Nao quero informar=6 |
| Necessidades especiais | select | Auditiva=2, Fisica=3, Intelectual=4, Multipla=5, Visual=1 |
| Nome contato de emergencia | text | Texto livre |
| Contato de emergencia | text (phone mask) | (00) 00000-0000 |
| Plano de saude | checkbox | Sim/Nao — habilita campos abaixo |
| Convenio | select (searchable) | Dados vem de cadastro de Convenios |
| Nome do convenio | text | Texto livre |
| Numero da carteirinha | text | Texto livre |

**Logica do Convenio:** Ha um botao para cadastrar novo convenio direto do modal, abrindo sub-modal com campos: Nome*, Prazo de pagamento (dias)*, Descricao.

#### ABA 6: Origem (`#indicationTab`)
| Campo | Tipo | Observacao |
|-------|------|------------|
| Origem | select (searchable) | Dados vem de cadastro de Origens |
| Nome | text | Texto livre |
| Observacoes | textarea | Texto longo |

**Logica:** Ha botao para cadastrar nova origem direto do modal: Nome*, Descricao.

#### ABA 7: Responsavel Financeiro (`#financialResponsibleTab`)
| Campo | Tipo |
|-------|------|
| Nome | text |
| CPF | text (mask) |

#### ABA 8: Tags (`#tagsTab`)
| Campo | Tipo |
|-------|------|
| Tags | text input com auto-complete | Permite multiplas tags |

---

## 5. MODULO: PRONTUARIO DO PACIENTE

**URL:** `/comercial/clientes/{id}/prontuario`

### 5.1 Cabecalho do Prontuario (Header Azul)
Exibido em TODAS as telas do prontuario:
- **Foto do paciente** (avatar circular com iniciais coloridas)
- **ID + Nome:** `{id} - {nome_completo}`
- **CPF:** exibido formatado
- **Contato:** telefone principal
- **Contato de emergencia:** nome + telefone
- **Etiqueta:** botao "Adicionar etiqueta" (badge azul)
- **Icone Resumo do paciente** → `/atendimento/resumo/{id}/visualizar`
- **Icone Historico** (botao)
- **Icone Editar** → `/comercial/clientes/{id}/prontuario/editar`

### 5.2 Sidebar do Prontuario (Menu Lateral)
```
Pesquisar paciente (campo busca)
---
Historico do paciente     → /clinico/timeline/{id}
Anamnese                  → /clinico/anamnese/{id}
Alergias                  → /clinico/alergias/{id}
Evolucoes                 → /clinico/evolucao/{id}
Receitas                  → /clinico/receita/{id}
Memed                     → (integracao externa)
Atestados                 → /clinico/atestados/{id}
Laudos                    → /clinico/laudos/{id}
Exames                    → (submenu expansivel)
Support Lab               → /supportlab/visualizar-paciente/{id}
Planos                    → /clinico/planos/{id}
Anexos                    → /clinico/anexos/{id}
Dietas                    → /clinico/dietas/{id}
CID's                     → /clinico/cid/{id}
Galeria                   → /clinico/galeria/{id}
Documentos                → /clinico/termo/{id}
```

### 5.3 Prontuario - Visualizacao Principal
**URL:** `/comercial/clientes/{id}/prontuario`

Organizado em secoes read-only (dados do cadastro do paciente):

#### INFORMACOES BASICAS
Nome | Nome social | Data de nascimento | Sexo | Estado civil | Nome da mae | Nome do pai | Conjuge

#### DOCUMENTACAO E IDENTIDADE
CPF | RG | Orgao Expedidor | Estado | Data de Emissao

#### INFORMACOES DE CONTATO
Telefone | Celular | WhatsApp | E-mail

#### ENDERECO E LOCALIZACAO
CEP | Endereco | Estado | Cidade | Bairro | Numero | Referencia | Complemento

#### INFORMACOES COMPLEMENTARES
Escolaridade | Profissao | Renda mensal | Necessidades especiais | Nome contato de emergencia | Contato de emergencia | Plano de saude (checkbox) | Convenio | Numero da carteirinha

#### INFORMACOES DE ORIGEM
Origem | Nome | Observacoes (textarea)

#### RESPONSAVEL FINANCEIRO
Nome | CPF

#### INFORMACOES DO CADASTRO (meta-dados)
Data de criacao (datetime) | Responsavel pelo cadastro (nome do usuario)

---

### 5.4 Historico do Paciente (Timeline)
**URL:** `/clinico/timeline/{id}`

#### Filtros
| Campo | Tipo | Observacao |
|-------|------|------------|
| Itens | Multi-select | Tipos de registros para filtrar |
| Profissional | Multi-select | Lista de profissionais (ex: "Todos selecionados (26)") |
| De | date | Data inicio (obrigatorio) |
| Ate | date | Data fim (obrigatorio) |
| PESQUISAR | button | Aplica filtros |

#### Timeline
Exibe lista cronologica de todos os registros do paciente. Cada item mostra:
- Icone do tipo de registro
- Data/hora (badge verde)
- Nome do profissional
- Tipo do registro (ex: "Pedido de exame")
- Botoes de acao: copiar, visualizar

**Logica:** A timeline agrega TODOS os tipos de prontuario (anamnese, evolucao, receita, atestado, laudo, exame, etc.) em uma unica visualizacao cronologica. Pode ser impressa (icone de impressora).

---

### 5.5 Anamneses
**URL:** `/clinico/anamnese/{id}`

#### Listagem
| Coluna | Ordenavel |
|--------|-----------|
| Data | Sim (default desc) |
| Titulo | Sim |
| Profissional | Sim |
| Opcoes | Nao — Visualizar (olho), Editar (lapis), Menu (...) |

**Status:** Exibe badge "RASCUNHO" (amarelo) quando nao finalizado.

#### Formulario de Adicionar Anamnese (`/clinico/anamnese/{id}/criar`)
| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| Usar modelo | select | Nao | Lista de modelos de anamnese cadastrados |
| Assinar digitalmente | select | Nao | Lista de certificados digitais disponiveis |
| Titulo | text | Nao | Nome da anamnese |

**Secao PERGUNTAS:**
- Pergunta (text) + Tipo (select: Texto) + Botao ADICIONAR
- Permite adicionar perguntas dinamicamente

**Secao QUESTIONARIO:**
- Area para as respostas do questionario montado

**Secao CID:**
- Campo de pesquisa CID (auto-complete buscando na tabela CID-10)

**Secao RESTRICOES:**
- Toggle: "Bloquear anamnese" (impede edicao posterior)

**Secao OPCOES:**
- Checkbox: Salvar como modelo
- Checkbox: Enviar para paciente
- Checkbox: Salvar e imprimir

**Upload de Arquivos:**
- Drag & drop ou botao Procurar
- Extensoes aceitas: jpg, jpeg, png, bmp, gif, doc, docx, pdf, csv, xls, xlsx, txt, zip, text/plain

**Botao:** SALVAR INFORMACOES

---

### 5.6 Alergias
**URL:** `/clinico/alergias/{id}`

**Formato:** Formulario unico com multiplas secoes de checkboxes.

#### Coluna Esquerda — Queixas e Historico

**Queixa principal:**
- [ ] Nariz
- [ ] Olhos
- [ ] Pulmao
- [ ] Pele
- [ ] Alergia Alimentar

**Historia da doenca atual — Alergia respiratoria:**
- [ ] Tosse
- [ ] Coriza
- [ ] Prurido nasoocular
- [ ] Prurido em orofaringe e ouvidos
- [ ] Roncos noturnos
- [ ] Dorme com a boca aberta
- [ ] Otorreia
- [ ] Refluxo Ge
- [ ] Sibilancia
- [ ] Dispneia noturna
- [ ] Dispneia diurna e noturna

**Alergia Cutanea:**
- [ ] Estrofulo
- [ ] Urticaria
- [ ] Dermatite atopica

**Alergia Alimentar:**
- [ ] Alergia ao leite de vaca
- [ ] Alergia a ovo
- [ ] Alergia a soja
- [ ] Alergia/intolerancia frutos do mar
- [ ] Alergia a corantes
- [ ] Outras (textarea)

**Reacoes a medicamento:**
- [ ] AINNH (textarea)
- [ ] Anti hipertensivos (textarea)
- [ ] Ansioliticos (textarea)
- [ ] Antibioticos
- [ ] Outros (textarea)

**Historia Patologica Pregressa:**
- [ ] Asma Bronquica
- [ ] Pneumonias
- [ ] Urticarias
- [ ] Sinusites
- [ ] Amigdalites
- [ ] Refluxos Ge
- [ ] Gastrite/esofagite eosinofilica
- [ ] Estrofulo
- [ ] Reacoes a insetos
- [ ] Doenca cardiovascular
- [ ] Hipertensao arterial
- [ ] Diabetes
- [ ] Cancer
- [ ] Tuberculose pulmonar/pleural
- [ ] Tuberculose ganglionar

**Historia Familiar:**
- [ ] AB
- [ ] Rinite
- [ ] Urticaria
- [ ] Estrofulo
- [ ] Reacoes a drogas
- [ ] Dermatite de contato
- [ ] Dermatite atopica
- [ ] Outras (textarea)

#### Coluna Direita — Exames e Conduta

**Medicamentos em uso:**
- [ ] Propranolol
- [ ] Enalapril
- [ ] Benzodiazepinicos
- [ ] Inibidores da eca
- [ ] Diureticos tiazidicos
- [ ] Antialegicos
- [ ] Corticosteroides

**Exame Fisico:**
- [ ] Pele (textarea)
- [ ] Ar (textarea)
- [ ] Rin Ant (textarea)
- [ ] Or (textarea)

**Testes alergicos:**
- [ ] DP (textarea)
- [ ] DF (textarea)
- [ ] CP (textarea)
- [ ] CN (textarea)

**Conduta:**
- [ ] Medicamentos (textarea)
- [ ] Exames (textarea)

**RESTRICOES:**
- Toggle: "Bloquear alergias"
- Checkbox: "Alertar no sistema" (exibe alerta em outras telas)

**Botao:** SALVAR INFORMACOES

---

### 5.7 Evolucoes
**URL:** `/clinico/evolucao/{id}`

#### Listagem
| Coluna | Ordenavel | Descricao |
|--------|-----------|-----------|
| Data de criacao | Sim (default desc) | Tooltip explicativo |
| Data da evolucao | Sim | Tooltip explicativo |
| Tipo | Sim | "Evolucao" + badge RASCUNHO se aplicavel |
| Profissional | Sim | Nome completo |
| Opcoes | Nao | Visualizar, Editar, Menu (...) |

#### Formulario de Adicionar Evolucao (`/clinico/evolucao/{id}/criar`)
| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| Usar modelo | select | Nao | Lista de modelos de evolucao |
| Assinar digitalmente | select | Nao | Certificados digitais |
| Data | date | Sim (*) | Data da evolucao (default: hoje) |
| Conteudo | Rich Text Editor | Sim (*) | Editor completo (WYSIWYG) |

**Rich Text Editor — Toolbar:**
Font family (HELVETICA NEUE), Bold, Italic, Underline, Highlight, Strikethrough, Format Painter, Lista nao-ordenada, Lista ordenada, Alinhamento, Tamanho da fonte (13), Cor do texto, Tabela, Imagem, Link, Desfazer, Refazer, Limpar formatacao.

**RESTRICOES:**
- Toggle: "Bloquear evolucao"

**OPCOES:**
- Checkbox: Salvar como modelo
- Checkbox: Salvar e imprimir

**Botao:** SALVAR INFORMACOES

---

### 5.8 Receitas
**URL:** `/clinico/receita/{id}`

#### Listagem
| Coluna | Descricao |
|--------|-----------|
| Data de criacao | Timestamp |
| Data da receita | Data formatada |
| Nome | Nome da receita + badge RASCUNHO |
| Profissional | Nome completo |
| Opcoes | Editar (lapis), Excluir (lixeira), Menu (...) |

#### Formulario de Adicionar Receita (`/clinico/receita/{id}/criar`)

**Layout em 2 colunas:**

**Coluna Principal (esquerda):**
| Campo | Tipo | Descricao |
|-------|------|-----------|
| Usar modelo | select | Modelos de receita |
| Assinar digitalmente | select | Certificados |
| Nome | text | Nome da receita |
| Data | date | Data (default: hoje) |
| Mostrar Data | toggle | Exibir/ocultar data na impressao |
| Conteudo | Rich Text Editor | Corpo da receita (editor completo) |

**Painel Lateral (direita) — Catalogo de Medicamentos:**
Tabs: **MANIPULADOS** | **INDUSTRIALIZADO**

Sub-tabs dentro de Manipulados:
- **FORMULAS** — lista de formulas cadastradas
- **PROTOCOLOS** — lista de protocolos
- **SUBSTANCIAS** — lista de substancias

Campo de busca para filtrar itens. Checkbox "Exibir modelos da Support Health". Cada item tem botao "+" para adicionar ao conteudo da receita.

**RESTRICOES:**
- Toggle: "Bloquear receita"

**OPCOES:**
- Checkbox: Salvar e imprimir
- Checkbox: Controle especial
- Checkbox: Salvar como modelo

**Campo adicional:**
- Foco da receita (textarea)

**Nota de integracao:** "Use nossa integracao com o Memed para emitir receitas de controle especial."

**Botao:** SALVAR INFORMACOES

**Fonte de dados:** Formulas, Protocolos e Substancias vem de `/laboratorio/substancias` (modulo Receituario nos Cadastros).

---

### 5.9 Memed (Integracao)
Integracao externa com a plataforma Memed para prescricao digital de medicamentos.

---

### 5.10 Atestados
**URL:** `/clinico/atestados/{id}`

#### Listagem
| Coluna | Descricao |
|--------|-----------|
| Data | Timestamp |
| Nome | Nome do atestado |
| Profissional | Nome completo |
| Opcoes | Visualizar, Editar, Menu |

#### Formulario de Adicionar Atestado (`/clinico/atestados/{id}/criar`)
| Campo | Tipo | Descricao |
|-------|------|-----------|
| Usar modelo | select | Modelos de atestado |
| Assinar digitalmente | select | Certificados |
| Variaveis | select | Variaveis de substituicao automatica (nome do paciente, data, etc.) |
| Nome | text | Nome do atestado |
| Data | date | Data (default: hoje) |
| Atestado | Rich Text Editor (*) | Corpo do atestado |

**RESTRICOES:**
- Toggle: "Bloquear atestado"

**OPCOES:**
- Checkbox: Salvar como modelo
- Checkbox: Salvar e imprimir

**Botao:** SALVAR INFORMACOES

---

### 5.11 Laudos
**URL:** `/clinico/laudos/{id}`

Mesma estrutura de listagem (Data, Nome, Profissional, Opcoes) e formulario com: modelo, certificado digital, editor rich text, restricoes e opcoes.

---

### 5.12 Exames (Submenu Expansivel)
O item "Exames" na sidebar expande para revelar 2 sub-itens:

#### 5.12.1 Pedidos de Exame
**URL:** `/clinico/exames/{id}`

**Listagem:**
| Coluna | Ordenavel | Descricao |
|--------|-----------|-----------|
| Data de criacao | Sim (default desc) | Tooltip explicativo |
| Data do exame | Sim | Tooltip explicativo |
| Nome | Sim | Nome do pedido |
| Profissional | Sim | Nome completo |
| Opcoes | Nao | Visualizar, Editar, Menu (...) |

Botao: **ADICIONAR PEDIDO** → `/clinico/exames/{id}/criar`

**Formulario de Adicionar Pedido:**
| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| Descricao | text | Sim (*) | Nome/descricao do pedido |
| Assinar digitalmente | select | Nao | Certificados digitais disponiveis |
| Data | date | Sim (*) | Data do pedido (default: hoje) |
| Mostrar Data | toggle | Nao | Exibir/ocultar data na impressao (default: ON) |
| Conteudo | Rich Text Editor | Sim (*) | Corpo do pedido (editor WYSIWYG completo) |

**Painel Lateral — Tipos de pedidos:**
- Campo de busca "Pesquisar"
- Toggle "Meus modelos" (alterna entre modelos pessoais e catalogo geral)
- **Catalogo geral (categorias):** Avaliacao Cardiologica / Atividade Eletrica, Bioquimica, Fezes, Hematologia, Hormonologia, Acompanhamento medico para transporte intra-hospitalar, Aconselhamento genetico, e outros
- **Meus modelos:** Templates salvos pelo profissional
- Ao clicar em um tipo, o conteudo e inserido no Rich Text Editor

#### 5.12.2 Resultados de Exame
**URL:** `/clinico/exames/{id}/recebidos`

**Listagem:**
| Coluna | Ordenavel | Descricao |
|--------|-----------|-----------|
| Data | Sim (default desc) | Data do resultado |
| Nome | Sim | Nome do resultado |
| Profissional | Sim | Profissional responsavel |
| Opcoes | Nao | Acoes |

Botao: **ADICIONAR RESULTADO** → formulario similar ao de pedidos

---

### 5.13 Planos
**URL:** `/clinico/planos/{id}`

#### Listagem
| Coluna | Ordenavel | Descricao |
|--------|-----------|-----------|
| Nome | Sim | Nome do plano de tratamento |
| Data | Sim (default desc) | Data de criacao |
| Profissional | Sim | Nome completo |
| Status | Sim | Status do plano |
| Opcoes | Nao | Acoes |

---

### 5.14 Anexos
**URL:** `/clinico/anexos/{id}`

Listagem com Data, Nome, Profissional, Opcoes. Upload de arquivos vinculados ao paciente.

---

### 5.15 Dietas
**URL:** `/clinico/dietas/{id}`

#### Listagem
| Coluna | Descricao |
|--------|-----------|
| Data | Timestamp |
| Nome | Nome da dieta |
| Responsavel | Profissional responsavel |
| Opcoes | Acoes |

---

### 5.16 CID's (Tabela de Referencia)
**URL:** `/clinico/cid/{id}`

**Tabela CID-10 completa (somente leitura):**
| Coluna | Ordenavel | Descricao |
|--------|-----------|-----------|
| Codigo | Sim (default asc) | Ex: A00.0, A00.1, A01.0 |
| Descricao | Sim | Ex: "Colera devida a Vibrio 01, biotipo" |

Campo de busca para filtrar CIDs. Paginacao com select de itens por pagina.

**Fonte de dados:** Tabela CID-10 importada — provavelmente seed no banco de dados com todos os codigos CID.

---

### 5.17 Galeria de Imagens
**URL:** `/clinico/galeria/{id}`

- Upload de fotos (botao "ADICIONAR FOTO" com drag & drop)
- Botao: **COMPARAR IMAGENS** — permite comparar fotos antes/depois lado a lado

---

### 5.18 Documentos
**URL:** `/clinico/termo/{id}`

#### Listagem
| Coluna | Descricao |
|--------|-----------|
| Data | Timestamp |
| Documento | Nome/tipo do documento |
| Responsavel | Profissional |
| Status | Status do documento |
| Opcoes | Acoes |

**Fonte de dados:** Modelos de documentos vem de `/administracao/termos`.

---

## 6. MODULO: AGENDA

### 6.1 Agenda (Calendario)
**URL:** `/atendimento/agenda`

#### Sidebar
- Pesquisar paciente
- Gerenciar agendamentos → `/atendimento/agendar-atendimentos/agendamentos`
- Bloqueio de agenda → `/atendimento/bloqueios/listagem`

#### Filtros do Calendario
| Campo | Tipo | Descricao |
|-------|------|-----------|
| Status | select | "Todos os status" + filtros por status especifico |
| Profissional | select | Profissional cujos horarios serao exibidos |
| Data | date | Data do dia a visualizar |
| Botao pesquisa | button | Aplica filtros |
| AGENDAR | button (azul) | Abre modal de agendamento |

#### Icones adicionais no header
- Busca (lupa)
- Modo de visualizacao (icone grade) — alternar entre visualizacoes

#### Visualizacao dos Slots
Exibe lista vertical de slots de horario do dia selecionado:
```
[Dia] [Mes]   Status
[Hora]
```

Cada slot mostra:
- Dia e mes abreviado
- Horario (ex: 07:00, 07:30, 08:00)
- Status: **Disponivel** (clicavel) ou dados do agendamento
- Seta ">" para expandir detalhes

**Slot expandido mostra:**
- Status em destaque (ex: "DISPONIVEL")
- Periodo do slot (ex: "12 Mac, 07:00 - 07:30")
- Botao AGENDAR

**Logica dos slots:** Os horarios sao configurados por profissional. O intervalo padrao parece ser de 30 minutos.

#### Status de Agendamento (11 status confirmados + slot)
| Status | Cor Badge | Descricao |
|--------|-----------|-----------|
| Disponivel | Cinza claro | Slot livre (nao e um status de agendamento) |
| Agendado | Azul | Paciente agendado, aguardando confirmacao |
| Confirmado | Verde claro | Paciente confirmou presenca |
| Sala de espera | Amarelo | Paciente chegou e esta na sala de espera |
| Em atendimento | - | Paciente sendo atendido pelo profissional |
| Atendido | Verde | Atendimento concluido |
| Atrasado | - | Paciente em atraso para o horario |
| Faltou | Laranja | Paciente nao compareceu |
| Cancelado | Vermelho | Agendamento cancelado |
| Desmarcado | - | Paciente desmarcou o agendamento |
| Nao atendido | - | Paciente nao foi atendido |
| Reagendado | - | Agendamento foi reagendado para outra data |
| Bloqueado | Escuro | Horario bloqueado (nao e status de agendamento) |

**Fluxo principal de status:** Agendado → Confirmado → Sala de espera → Em atendimento → Atendido

**Opcoes na tabela de agendamentos (3 pontos):** Clonar agendamento, Cancelar agendamento

### 6.2 Modal de Agendamento

**Passo 1 — Selecao do Paciente:**
- Radio: **Selecionar paciente** | **Cadastro rapido**

**Se "Selecionar paciente":**
- Campo de busca: "Pesquisar paciente" (autocomplete com pacientes cadastrados)

**Se "Cadastro rapido":**
| Campo | Tipo | Obrigatorio |
|-------|------|-------------|
| Nome do paciente | text | Sim (*) |
| Paciente estrangeiro | checkbox | Nao |
| Telefone | text (mask) | Nao |
| Celular | text (mask) | Nao |
| WhatsApp | text (mask) | Nao |
| CPF | text (mask) | Nao |
| E-mail | email | Nao |
| Completar cadastro por e-mail | checkbox | Nao |
| Completar cadastro por WhatsApp | checkbox | Nao |

Botoes: FECHAR | SALVAR INFORMACOES

**Passo 2 — Detalhes do Agendamento (Agendar Atendimento):**
**URL:** `/atendimento/agendar-atendimentos/agendamento/{id}/criar`

**Pagina:** "Perfil do paciente" com sidebar do paciente (foto, nome, telefone) e links:
- Prontuario → `/comercial/clientes/{id}/prontuario`
- Visualizar cadastro → `/comercial/clientes/{id}/visualizar`
- Editar informacoes
- Historico de agendamentos → `/atendimento/resumo/{id}/historico`
- Resumo do paciente → `/atendimento/resumo/{id}/visualizar`

**Info Banner:** "O ultimo agendamento do paciente foi em: {data_hora}" (se houver agendamento anterior)

| Campo | Tipo | Obrigatorio | Opcoes/Descricao |
|-------|------|-------------|------------------|
| Tipo de agendamento | select | Sim (*) | Orcamento, Simples |
| Procedimentos | select (multi) | Sim (*) | Lista de procedimentos cadastrados |
| Profissional | select | Sim (*) | Lista de profissionais da clinica |
| Data | date | Sim (*) | dd/mm/aaaa |
| Hora inicial | time | Sim (*) | --:-- |
| Hora final | time | Sim (*) | --:-- |
| Botao copiar horario | icon button | Nao | Copia horarios de configuracao |
| Enviar anamnese(s) | select (multi) + botao enviar | Nao | Lista de modelos de anamnese + botao envelope |
| Encaixar horario | checkbox | Nao | Ignora conflito de horario |
| Teleconsulta | checkbox | Nao | Marca como teleconsulta |
| Agendar como confirmado | checkbox | Nao | Pula etapa "Agendado" e vai direto p/ "Confirmado" |
| Gerar orcamento | checkbox | Nao | Gera orcamento automaticamente ao salvar |
| Descricao | textarea | Nao | Observacoes/notas |

**Botao:** SALVAR INFORMACOES

### 6.2.1 Visualizar Agendamento
**URL:** `/atendimento/agendar-atendimentos/{agendamento_id}/visualizar`

**Stepper de Status (5 etapas visuais):**
```
[1] Agendado → [2] Confirmado → [3] Sala de espera → [4] Em atendimento → [5] Atendido
```
Cada etapa mostra a data/hora em que o status foi atingido. O step atual e destacado com check verde.

**Header de acoes:**
- Botao WhatsApp (icone verde)
- Botao **GERAR ORCAMENTO** (verde)
- Menu 3 pontos verticais:
  - Clonar agendamento
  - Editar informacoes
  - Cancelar agendamento
  - Ajustar status

**Informacoes exibidas (read-only):**
| Campo | Descricao |
|-------|-----------|
| Procedimento(s) | Tabela com lista de procedimentos |
| Data | Data + hora do agendamento |
| Hora inicial | Horario de inicio |
| Hora final | Horario de termino |
| Profissional | Nome do profissional |
| Descricao | Observacoes/notas |
| Responsavel pelo agendamento | Quem criou o agendamento |
| Data de agendamento | Timestamp da criacao |

**Botoes no rodape:**
- CANCELAR AGENDAMENTO (vermelho)
- EDITAR INFORMACOES (azul)

**Secao colapsavel:** "Alteracoes de status" — log de auditoria com historico de mudancas de status.

### 6.2.2 Historico de Agendamentos do Paciente
**URL:** `/atendimento/resumo/{id}/historico`

#### Filtros
| Campo | Tipo | Descricao |
|-------|------|-----------|
| Profissional | multi-select | Ex: "Todos selecionados (14)" |
| Status | multi-select | 11 status (ver abaixo) |
| De | date | Data inicio |
| Ate | date | Data fim |

#### Tabela
| Coluna | Descricao |
|--------|-----------|
| Agendamento | Nome do procedimento |
| Status | Badge colorido (SALA DE ESPERA=amarelo, ATENDIDO=verde, FALTOU=laranja, CANCELADO=vermelho, AGENDADO=azul) |
| Profissional | Nome completo |
| Data/Hora | Data e faixa horaria |
| Opcoes | Seta para abrir detalhes |

Botao de exportar (icone PDF) no canto superior direito.

### 6.2.3 Resumo do Paciente
**URL:** `/atendimento/resumo/{id}/visualizar`

**KPI Cards:**
| Card | Descricao |
|------|-----------|
| Atendimentos | Total de atendimentos realizados |
| Planos Terapeuticos | Total de planos terapeuticos criados |

**Secao:** PLANOS TERAPEUTICOS — lista dos planos do paciente.

### 6.3 Gerenciar Agendamentos
**URL:** `/atendimento/agendar-atendimentos/agendamentos`

#### Filtros
| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| Profissional | multi-select | Sim (*) | Ex: "Todos selecionados (14)" |
| Status | multi-select | Nao | Ex: "Todos selecionados (11)" |
| De | date | Sim (*) | Data inicio |
| Ate | date | Nao | Data fim |
| Botao pesquisa | button | — | Aplica filtros |

#### Tabela de Resultados
| Coluna | Descricao |
|--------|-----------|
| Paciente | Nome do paciente |
| Descricao | Descricao do agendamento/procedimento |
| Profissional | Nome do profissional |
| Status | Status atual |
| Data | Data/hora (ordenavel, default desc) |
| Opcoes | Acoes (editar, cancelar, etc.) |

**Rodape:** "Foram encontrados um total de X registros."

### 6.4 Bloqueio de Agenda
**URL:** `/atendimento/bloqueios/listagem`

#### Listagem de Bloqueios
- Botao: **ADICIONAR** (azul)
- Botao: **CANCELAR BLOQUEIOS** (cinza desabilitado quando nada selecionado)
- Filtro (funil)
- Select itens por pagina: 25

| Coluna | Descricao |
|--------|-----------|
| Checkbox | Selecao multipla para cancelamento em lote |
| Registro | Numero/ID do registro |
| Descricao | Motivo do bloqueio |
| Profissional | Profissional afetado |
| Data | Data do bloqueio |
| Periodo | Intervalo de horario bloqueado |
| Opcoes | Acoes |

#### Modal de Adicionar Bloqueio
**Tipo:** Radio — **Simples** | **Recorrente**

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| Profissional | select | Sim (*) | Profissional a bloquear |
| Descricao | text | Sim (*) | Motivo do bloqueio |
| Inicio | date | Sim (*) | Data inicio |
| Termino | date | Sim (*) | Data fim |
| Horario inicial | time | Sim (*) | Ex: 07:00 |
| Horario final | time | Sim (*) | Ex: 07:30 |
| Observacoes | textarea | Nao | Notas adicionais |

**Logica "Recorrente":** Provavelmente adiciona campos de recorrencia (dias da semana, frequencia).

**Botao:** SALVAR

---

## 7. MODULO: FINANCEIRO (NF-e)

**URL:** `/financeiro/nfe`

### 7.1 Sidebar
- NF-e (unico item)

### 7.2 Listagem de Notas Fiscais ("Todas as notas")
Botao: **GERAR NF-E** → `/financeiro/nfe/gerar`

#### Filtros
| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| De | date | Sim (*) | Data inicio (default: 01 do mes atual) |
| Ate | date | Sim (*) | Data fim (default: ultimo dia do mes) |
| Status | multi-select | Sim (*) | 6 status (ver abaixo) |
| PESQUISAR | button | — | Aplica filtros |

**Status de NF-e (6 opcoes):**
| Status | Value |
|--------|-------|
| Cancelada | 5 |
| Emitida | 2 |
| Erro | 4 |
| Negada | 3 |
| Processando | 1 |
| Solicitando Autorizacao | 6 |

#### Tabela
| Coluna | Ordenavel | Descricao |
|--------|-----------|-----------|
| Registro | Sim | ID/numero do registro |
| Paciente | Sim | Nome do paciente |
| Valor | Sim | Valor da nota |
| Status | Sim | Status da nota |
| Data | Sim | Data de emissao |
| Opcoes | Nao | Acoes |

### 7.3 Formulario Gerar NF-e (`/financeiro/nfe/gerar`)

#### Secao: DADOS DO TOMADOR
| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| CPF / CNPJ | text (mask) | Sim (*) | Documento do tomador |
| Nome | text | Sim (*) | Nome/razao social |
| CEP | text (mask) | Sim (*) | CEP do tomador |
| Estado | select | Sim (*) | UF |
| Cidade | select (dinamico) | Sim (*) | Cidade do estado selecionado |
| Bairro | text | Sim (*) | Bairro |
| Endereco | text | Sim (*) | Logradouro |
| Numero | text | Sim (*) | Numero |
| Complemento | text | Nao | Complemento |
| E-mail | email | Nao | Email para envio da NF-e |
| Salvar dados do tomador | toggle | Nao | Salva dados para reutilizacao |

#### Secao: INFORMACOES DA NOTA FISCAL
| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| Descricao do servico | textarea | Sim (*) | Descricao do servico prestado |
| Observacoes | textarea | Nao | Observacoes adicionais |
| Valor da nota | currency (R$) | Sim (*) | Valor total |
| INSS (R$) | currency | Nao | Retencao INSS |
| IR (R$) | currency | Nao | Retencao IR |
| COFINS (R$) | currency | Nao | Retencao COFINS |
| PIS (R$) | currency | Nao | Retencao PIS |
| CSLL (R$) | currency | Nao | Retencao CSLL |
| Servico | select | Nao | Tipo de servico |
| Gerar NFe por | select | Nao | Metodo (default: Padrao) |
| ISS retido fonte | toggle | Nao | ISS retido na fonte |
| Enviar nota por e-mail | toggle | Nao | Envia automaticamente ao tomador |

**Botao:** GERAR NF-E

---

## 8. MODULO: VENDAS (ORCAMENTOS)

**URL:** `/comercial/orcamentos`

### 8.1 Sidebar
- Orcamentos (link principal)
- Listar pacientes → `/comercial/orcamentos/pacientes`

### 8.2 Listagem de Orcamentos ("Todos os orcamentos")
Botao: **CRIAR ORCAMENTO** → `/comercial/orcamentos/criar`

#### Filtros
| Campo | Tipo | Descricao |
|-------|------|-----------|
| Paciente | search (autocomplete) | Busca por nome do paciente |
| Responsavel | select | Profissional responsavel pelo orcamento |
| Prescritor | select | Profissional prescritor |
| Procedimento | select | Filtro por procedimento |
| Status | multi-select | Liberado, Orcado, Pendente |
| De | date | Sim (*) | Data inicio |
| Ate | date | Sim (*) | Data fim |
| PESQUISAR | button | Aplica filtros |

#### Tabela
| Coluna | Ordenavel | Descricao |
|--------|-----------|-----------|
| Registro | Sim | ID do orcamento |
| Paciente | Sim | Nome do paciente |
| Prescritor | Sim | Nome do prescritor |
| Valor | Sim | Valor bruto |
| Desconto | Sim | Valor do desconto |
| Total | Sim | Valor final |
| Data | Sim | Data de criacao |
| Status | Sim | Status do orcamento |
| Opcoes | Nao | Acoes |

### 8.3 Formulario Criar Orcamento (`/comercial/orcamentos/criar`)

#### Secao: INFORMACOES DO ORCAMENTO
| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| Paciente | search (autocomplete) | Sim (*) | Busca paciente cadastrado |
| Profissional | select | Sim (*) | Profissional responsavel |

**Tabs para adicionar itens:** PROCEDIMENTOS | PROTOCOLOS

**Aba Procedimentos:**
| Campo | Tipo | Descricao |
|-------|------|-----------|
| Procedimentos | select | Lista de procedimentos cadastrados |
| Sessoes | number | Quantidade de sessoes |
| Vezes | number | Frequencia |
| Periodicidade | select | por semana, por mes, etc. |
| ADICIONAR | button | Adiciona ao orcamento |

#### Secao: ITENS DO ORCAMENTO (tabela dinamica)
| Coluna | Descricao |
|--------|-----------|
| Procedimento | Nome do procedimento |
| Valor | Valor unitario |
| Sessoes | Quantidade |
| Total | Valor calculado (valor x sessoes) |

#### Secao: TOTALIZADOR
| Campo | Tipo | Descricao |
|-------|------|-----------|
| Desconto | select (% ou R$) + valor | Tipo e valor do desconto |
| Valor total do orcamento | currency (read-only) | Calculado automaticamente |
| Quantidade de parcelas | number | Numero de parcelas |
| Valor total com desconto | currency (read-only) | Calculado |
| Valor de cada parcela | currency (read-only) | Calculado |

#### Observacoes
| Campo | Tipo | Descricao |
|-------|------|-----------|
| Observacoes | textarea | Notas adicionais |

**Botoes:** SALVAR E SAIR | LIBERAR ORCAMENTO

**Status do Orcamento:** Pendente → Orcado → Liberado

---

## 9. NOTA SOBRE "FECHAMENTO DE CAIXA"

O sistema Support Clinic v2.13.68 **nao possui um modulo dedicado de "Fechamento de Caixa"**. O fluxo financeiro opera da seguinte forma:

1. **Agendamento** → Paciente e agendado com procedimento(s)
2. **Orcamento** → Pode ser gerado a partir do agendamento (botao "GERAR ORCAMENTO") ou manualmente em Vendas > Orcamentos
3. **NF-e** → Nota fiscal e gerada no modulo Financeiro > NF-e

O Dashboard (Home) fornece **metricas de atendimento** (agendamentos, confirmados, faltaram, atendidos) mas nao tem consolidacao financeira (receita total, formas de pagamento, etc.). Para implementar um "fechamento de caixa", seria necessario criar um modulo customizado que consolide orcamentos pagos + NF-e emitidas por periodo.

---

## 10. FONTES DE DADOS E TABELAS DE REFERENCIA

### 10.1 Tabelas Semeadas (Seed Data)
Estas tabelas sao pre-populadas no banco de dados:

| Tabela | Origem | Valores |
|--------|--------|---------|
| **Sexo** | Enum/tabela | Feminino (2), Masculino (1) |
| **Estado Civil** | Tabela | Amasiado(a)=6, Casado(a)=2, Divorciado(a)=4, Separado(a)=5, Solteiro(a)=1, Viuvo(a)=3 |
| **Estados BR** | Tabela (27 registros) | Acre=1 ... Tocantins=27 |
| **Cidades** | Tabela (dinâmica por estado) | Carregadas via API quando estado e selecionado |
| **Orgaos Expedidores** | Tabela (20 registros) | SSP=1, PM=2, PC=3, CNT=4, ... ZZZ=20 |
| **Escolaridade** | Tabela (12 registros) | Analfabeto=1 ... Pos-graduado doutorado=12 |
| **Renda Mensal** | Tabela (8 faixas) | ate R$ 1.000=1 ... acima R$ 20.000=8 |
| **Necessidades Especiais** | Tabela (5 registros) | Visual=1, Auditiva=2, Fisica=3, Intelectual=4, Multipla=5 |
| **CID-10** | Tabela (milhares de registros) | Codigo + Descricao (A00.0 ate Z99.9) |
| **Status de Agendamento** | Enum/tabela (11 registros) | Agendado, Atendido, Atrasado, Cancelado, Confirmado, Desmarcado, Em atendimento, Faltou, Nao atendido, Reagendado, Sala de espera |
| **Status de NF-e** | Enum/tabela (6 registros) | Processando=1, Emitida=2, Negada=3, Erro=4, Cancelada=5, Solicitando Autorizacao=6 |
| **Status de Orcamento** | Enum/tabela (3 registros) | Pendente, Orcado, Liberado |

### 10.2 Tabelas Configuradas pela Clinica
| Tabela | Cadastro em | Descricao |
|--------|-------------|-----------|
| **Profissionais** | `/humanos/colaboradores` | Profissionais da clinica |
| **Procedimentos** | `/clinico/tratamentos` | Procedimentos/tratamentos oferecidos |
| **Protocolos** | `/clinico/tratamentos` → Protocolos | Protocolos clinicos |
| **Substancias** | `/laboratorio/substancias` | Substancias para receitas |
| **Formulas** | Receituario > Formulas | Formulas manipuladas |
| **Medicamentos** | Receituario > Medicamentos | Medicamentos industrializados |
| **Convenios** | Cadastro inline (modal) | Planos de saude aceitos |
| **Origens** | Cadastro inline (modal) | Como paciente conheceu a clinica |
| **Modelos de Anamnese** | `/clinico/modelos/anamneses` | Templates de anamnese |
| **Modelos de Atestado** | `/clinico/modelos/atestados` | Templates de atestado |
| **Modelos de Dieta** | `/clinico/modelos/dietas` | Templates de dieta |
| **Modelos de Evolucao** | `/clinico/modelos/evolucao` | Templates de evolucao |
| **Modelos de Exame** | `/clinico/modelos/exames` | Templates de exame |
| **Modelos de Laudo** | `/clinico/modelos/laudos` | Templates de laudo |
| **Modelos de Receita** | `/clinico/modelos/receitas` | Templates de receita |
| **Modelos de Documento** | `/administracao/termos` | Termos/documentos da clinica |

---

## 11. PADROES DE INTERFACE (UI Patterns)

### 11.1 Padrao de Listagem
Todas as listagens seguem o mesmo padrao:
1. **Titulo** da secao
2. **Botao de acao principal** (ADICIONAR X) — azul, alinhado a direita
3. **Campo de busca** (Pesquisar...)
4. **Select de itens por pagina** (10/25/50)
5. **Tabela com colunas ordenaveis** (setas up/down)
6. **Opcoes por linha** (icones: visualizar, editar, menu)
7. **Rodape:** "Mostrando resultado X ate Y de Z itens"
8. **Paginacao:** Previous | 1, 2, 3... | Next

### 11.2 Padrao de Formulario Clinico
Documentos clinicos (Anamnese, Evolucao, Receita, Atestado, Laudo) seguem:
1. **Usar modelo** (select — carrega template)
2. **Assinar digitalmente** (select — certificados)
3. **Campos especificos do tipo**
4. **Editor Rich Text** (WYSIWYG completo)
5. **Secao CID** (quando aplicavel)
6. **Secao RESTRICOES** — toggle "Bloquear {tipo}"
7. **Secao OPCOES** — checkboxes (Salvar como modelo, Enviar para paciente, Salvar e imprimir)
8. **Upload de arquivos** (drag & drop + botao)
9. **Botao SALVAR INFORMACOES** (azul)

### 11.3 Status e Badges
| Badge | Cor | Descricao |
|-------|-----|-----------|
| ATIVO | Verde | Paciente/item ativo |
| INATIVO | Cinza | Paciente/item inativo |
| RASCUNHO | Amarelo | Documento nao finalizado |

### 11.4 Seguranca (CSRF)
Todos os formularios incluem token CSRF em campo hidden:
```html
<input type="hidden" value="{csrf_token}">
```

---

## 12. LOGICAS DE NEGOCIO IMPORTANTES

### 12.1 Multi-tenancy
- Cada clinica tem um ID unico (ex: 22497)
- Todos os dados sao isolados por clinica
- URLs nao incluem o ID da clinica (vem da sessao)

### 12.2 Prontuario Eletronico
- Cada registro clinico tem: criador (profissional), data de criacao, data do registro
- Registros podem ser bloqueados (impede edicao)
- Registros podem ser salvos como modelo para reuso
- Todos os registros aparecem no Timeline/Historico
- Suporte a assinatura digital (certificados)

### 12.3 Agenda
- Slots de horario sao gerados baseados na configuracao do profissional
- Intervalo padrao: 30 minutos
- Status do agendamento segue fluxo: Disponivel → Agendado → Confirmado → Chegou → Em atendimento → Atendido
- Bloqueios podem ser simples ou recorrentes
- Filtros permitem multi-selecao de profissionais e status

### 12.4 Pacientes
- Cadastro pode ser completado pelo proprio paciente via link (email/WhatsApp)
- Status: Ativo/Inativo (soft delete)
- Tags para categorizacao
- Busca por nome e telefone
- Campos obrigatorios sao configuraveis pela clinica

### 12.5 Chat Interno
Widget de chat no canto inferior direito, com lista de contatos da clinica e busca de historico por paciente.

### 12.6 Variaveis em Templates
Atestados e possivelmente outros documentos suportam variaveis de substituicao automatica (nome do paciente, CPF, data, profissional, etc.).

---

## 13. INTEGRACAO MEMED
O sistema possui integracao com a plataforma **Memed** para prescricao digital de medicamentos, especialmente para receitas de controle especial.

---

## 14. RESUMO DE URLs MAPEADAS

```
=== DASHBOARD ===
/home                                                          → Dashboard (Home)

=== AGENDA ===
/atendimento/agenda                                            → Agenda (calendario de slots)
/atendimento/agendar-atendimentos/agendamentos                 → Gerenciar agendamentos (listagem)
/atendimento/agendar-atendimentos/agendamento/{id}/criar       → Agendar atendimento (Step 2)
/atendimento/agendar-atendimentos/{agendamento_id}/visualizar  → Visualizar agendamento (stepper + detalhes)
/atendimento/resumo/{id}/historico                             → Historico de agendamentos do paciente
/atendimento/resumo/{id}/visualizar                            → Resumo do paciente (KPIs)
/atendimento/bloqueios/listagem                                → Bloqueio de agenda

=== PACIENTES ===
/comercial/clientes                            → Listagem de pacientes
/comercial/clientes/criar                      → Adicionar paciente
/comercial/clientes/{id}/prontuario            → Prontuario (visualizacao)
/comercial/clientes/{id}/prontuario/editar     → Prontuario (edicao)
/comercial/clientes/{id}/visualizar            → Visualizar paciente

=== PRONTUARIO ===
/clinico/timeline/{id}                         → Historico do paciente (timeline)
/clinico/anamnese/{id}                         → Anamneses (listagem)
/clinico/anamnese/{id}/criar                   → Adicionar anamnese
/clinico/alergias/{id}                         → Alergias
/clinico/evolucao/{id}                         → Evolucoes (listagem)
/clinico/evolucao/{id}/criar                   → Adicionar evolucao
/clinico/receita/{id}                          → Receitas (listagem)
/clinico/receita/{id}/criar                    → Adicionar receita
/clinico/atestados/{id}                        → Atestados (listagem)
/clinico/atestados/{id}/criar                  → Adicionar atestado
/clinico/laudos/{id}                           → Laudos (listagem)
/clinico/exames/{id}                           → Exames > Pedidos (listagem)
/clinico/exames/{id}/criar                     → Adicionar pedido de exame
/clinico/exames/{id}/recebidos                 → Exames > Resultados (listagem)
/clinico/planos/{id}                           → Planos
/clinico/anexos/{id}                           → Anexos
/clinico/dietas/{id}                           → Dietas
/clinico/cid/{id}                              → Tabela CID
/clinico/galeria/{id}                          → Galeria de imagens
/clinico/termo/{id}                            → Documentos
/supportlab/visualizar-paciente/{id}           → Support Lab

=== VENDAS ===
/comercial/orcamentos                          → Listagem de orcamentos
/comercial/orcamentos/criar                    → Criar orcamento
/comercial/orcamentos/pacientes                → Listar pacientes (orcamentos)

=== FINANCEIRO ===
/financeiro/nfe                                → Listagem de NF-e
/financeiro/nfe/gerar                          → Gerar NF-e

=== OUTROS ===
/administracao/estoque                         → Estoque (Produtos)
/compras/demandas                              → Pedidos (Produtos)
/marketing/automacoes/todas                    → Relacionamento (Vendas)
/humanos/colaboradores                         → Cadastros gerais
/clinico/tratamentos                           → Cadastro clinico (procedimentos)
/laboratorio/substancias                       → Receituario (substancias)
/clinico/modelos/anamneses                     → Modelos de prontuario
/administracao/termos                          → Modelos de documentos
/academy                                       → Academy
/configuracoes/perfil                          → Configuracoes / Editar perfil
/configuracoes/perfil/clinica                  → Perfil da clinica
/configuracoes/logins                          → Logins ativos
/faturas                                       → Planos e pagamentos
```

---

*Documento gerado por analise direta do sistema Support Clinic v2.13.68 em 12/03/2026*
