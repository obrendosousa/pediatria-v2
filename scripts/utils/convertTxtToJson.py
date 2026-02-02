#!/usr/bin/env python3
"""
Script para converter arquivos .txt do pygrowup para JSON
Baseado na estrutura de dados do pygrowup
"""

import json
import sys
import os
from pathlib import Path

def convert_txt_to_json(txt_file_path, output_dir):
    """Converte um arquivo .txt do pygrowup para JSON"""
    try:
        with open(txt_file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Pular cabeçalho se existir
        start_idx = 0
        for i, line in enumerate(lines):
            if line.strip() and not line.strip().startswith('#'):
                # Verificar se é cabeçalho (contém nomes de colunas)
                if 'Month' in line or 'SD0' in line or 'L' in line:
                    start_idx = i
                    break
        
        # Parsear dados
        data = []
        headers = None
        
        for line in lines[start_idx:]:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            # Primeira linha pode ser cabeçalho
            if headers is None:
                # Tentar detectar se é cabeçalho ou dados
                parts = line.split('\t') if '\t' in line else line.split()
                if 'Month' in parts or 'SD0' in parts:
                    headers = [h.strip() for h in parts]
                    continue
            
            # Parsear linha de dados
            parts = line.split('\t') if '\t' in line else line.split()
            if len(parts) < 2:
                continue
            
            try:
                row = {}
                # Mapear colunas comuns
                for i, part in enumerate(parts):
                    part = part.strip()
                    if not part:
                        continue
                    
                    # Tentar converter para número
                    try:
                        value = float(part) if '.' in part else int(part)
                    except:
                        value = part
                    
                    # Mapear nomes de colunas conhecidos
                    if i == 0:
                        row['Month'] = value
                    elif 'SD0' in str(part) or (headers and i < len(headers) and 'SD0' in headers[i]):
                        row['SD0'] = value
                    elif 'SD1' in str(part) or (headers and i < len(headers) and 'SD1' in headers[i]):
                        row['SD1'] = value
                    elif 'SD2' in str(part) or (headers and i < len(headers) and 'SD2' in headers[i]):
                        row['SD2'] = value
                    elif 'SD3' in str(part) or (headers and i < len(headers) and 'SD3' in headers[i]):
                        row['SD3'] = value
                    elif 'SD2neg' in str(part) or 'SD2neg' in str(part) or (headers and i < len(headers) and 'SD2neg' in headers[i]):
                        row['SD2neg'] = value
                    elif 'SD3neg' in str(part) or (headers and i < len(headers) and 'SD3neg' in headers[i]):
                        row['SD3neg'] = value
                    elif 'L' in str(part) and len(str(part)) < 10:
                        row['L'] = value
                    elif 'M' in str(part) and len(str(part)) < 10:
                        row['M'] = value
                    elif 'S' in str(part) and len(str(part)) < 10:
                        row['S'] = value
                    else:
                        # Usar nome da coluna do cabeçalho se disponível
                        if headers and i < len(headers):
                            row[headers[i]] = value
                        else:
                            row[f'col_{i}'] = value
                
                if row:
                    data.append(row)
            except Exception as e:
                print(f"Erro ao processar linha: {line[:50]}... - {e}", file=sys.stderr)
                continue
        
        # Salvar JSON
        output_file = Path(output_dir) / (Path(txt_file_path).stem + '.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Convertido: {Path(txt_file_path).name} -> {output_file.name} ({len(data)} linhas)")
        return True
        
    except Exception as e:
        print(f"❌ Erro ao converter {txt_file_path}: {e}", file=sys.stderr)
        return False

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Uso: python convertTxtToJson.py <arquivo_txt> <pasta_saida>")
        sys.exit(1)
    
    txt_file = sys.argv[1]
    output_dir = sys.argv[2]
    
    os.makedirs(output_dir, exist_ok=True)
    convert_txt_to_json(txt_file, output_dir)
