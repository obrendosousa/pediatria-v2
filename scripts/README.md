# Scripts de Importação de Dados

## Importação de Dados de Crescimento OMS/CDC

Este script importa dados de referência das curvas de crescimento da OMS (WHO) e CDC do repositório pygrowup para o banco de dados Supabase.

### Pré-requisitos

1. **Executar SQL de criação da tabela:**
   ```sql
   -- Execute no Supabase SQL Editor
   -- Arquivo: database/create_growth_standards_table.sql
   ```

2. **Variáveis de ambiente configuradas:**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (necessária para bypassar RLS)

3. **Git instalado** (para clonar repositório pygrowup)

### Como usar

```bash
# Executar script de importação
npm run seed:growth
```

O script irá:
1. Baixar/clonar o repositório pygrowup do GitHub
2. Localizar arquivos JSON na pasta `pygrowup/pygrowup/data/`
3. Parsear nomes dos arquivos para extrair metadados (tipo, gênero, fonte, faixa etária)
4. Mapear campos JSON para estrutura do banco de dados
5. Importar dados em lotes usando upsert (evita duplicatas)

### Estrutura de Dados

Os arquivos JSON do pygrowup seguem o formato:
```json
[
  {
    "Month": 0,
    "L": -0.3833,
    "M": 3.3464,
    "S": 0.14602,
    "SD0": 3.3464,
    "SD1": 3.8364,
    "SD2": 4.3264,
    "SD3": 4.8164,
    "SD2neg": 2.3664,
    "SD3neg": 1.8764
  },
  ...
]
```

### Convenções de Nomenclatura

O script parseia nomes de arquivos seguindo padrões como:
- `wfa_boys_0_5_zscores.json` → Weight for Age, Meninos, 0-5 anos, WHO
- `bmifa_girls_2_5_zscores.json` → BMI for Age, Meninas, 2-5 anos, WHO
- `wfa_boys_cdc.json` → Weight for Age, Meninos, CDC

### Tipos de Curva Suportados

- `wfa` - Weight for Age (Peso para Idade)
- `lhfa` - Length/Height for Age (Estatura para Idade)
- `bmifa` - BMI for Age (IMC para Idade)
- `hcfa` - Head Circumference for Age (Perímetro Cefálico para Idade)
- `wfl` - Weight for Length (Peso para Comprimento)
- `wfh` - Weight for Height (Peso para Estatura)

### Relatório de Importação

Após a execução, o script exibe um relatório com:
- Total de arquivos processados
- Linhas inseridas
- Erros encontrados (se houver)

### Cache Local

Os dados baixados são salvos em `data/standards/`. Para forçar novo download, delete esta pasta antes de executar o script.

### Troubleshooting

**Erro: "Tabela não existe"**
- Execute o SQL de criação da tabela primeiro

**Erro: "Variáveis de ambiente não configuradas"**
- Verifique se `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` estão no `.env.local`

**Erro: "Git não encontrado"**
- Instale Git ou use método alternativo de download

**Nenhum arquivo encontrado**
- Verifique se o repositório pygrowup tem a estrutura esperada
- Os arquivos devem estar em `pygrowup/pygrowup/data/` ou `pygrowup/data/`
