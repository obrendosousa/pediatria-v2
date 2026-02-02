# Instruções para Converter Arquivos .txt para JSON

O repositório pygrowup contém os dados em formato `.txt` na pasta `pygrowup/tables/`. Você precisa convertê-los para JSON antes de importar.

## Opção 1: Usar pygrowup (Recomendado)

1. **Instale o pygrowup:**
   ```bash
   pip install pygrowup
   ```

2. **Clone o repositório (se ainda não fez):**
   ```bash
   git clone https://github.com/ewheeler/pygrowup.git
   ```

3. **Os dados já estão disponíveis após instalar:**
   O pygrowup instala os dados em formato que pode ser acessado via Python. Você pode criar um script Python simples para exportar para JSON.

## Opção 2: Converter Manualmente

Se você já tem os arquivos `.txt` na pasta `pygrowup/pygrowup/tables/`, você pode:

1. **Criar uma pasta para os JSONs:**
   ```bash
   mkdir -p data/pygrowup
   ```

2. **Converter os arquivos manualmente:**
   Os arquivos `.txt` do pygrowup geralmente têm formato tab-separated. Você pode usar o script Python fornecido ou converter manualmente.

3. **Colocar os JSONs convertidos em:**
   ```
   data/pygrowup/
   ```

## Opção 3: Usar Script de Conversão

Um script Python básico está disponível em `scripts/utils/convertTxtToJson.py`:

```bash
python scripts/utils/convertTxtToJson.py pygrowup/pygrowup/tables/wfa_boys_0_5_zscores.txt data/pygrowup/
```

## Estrutura Esperada dos Arquivos JSON

Os arquivos JSON devem ter o formato:
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

## Após Converter

Depois de ter os arquivos JSON em `data/pygrowup/`, execute:

```bash
npm run seed:growth
```

O script detectará automaticamente os arquivos JSON locais e os usará.
