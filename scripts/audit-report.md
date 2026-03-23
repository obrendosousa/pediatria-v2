# Relatório de Auditoria de Memórias da Clara
**Gerado em:** 23/03/2026, 13:15:36
**Progresso:** 24/24 batches
**Total auditado:** 470 memórias

---

## Resumo

| Veredicto | Quantidade | % |
|-----------|-----------|---|
| ✅ OK | 391 | 83% |
| ⚠️ SUSPEITA | 51 | 11% |
| ❌ ERRADA | 28 | 6% |

---

## ❌ ERRADAS — Remover ou corrigir imediatamente

### `protocolo-clinico/os-bebes-realizaram-testes-da-linguinha-ouvido-pezinho-e-olho-acompanhamento`
**Tipo:** protocolo_clinico
**Motivo:** A menção à 'Maternidade Marly Sarney' parece ser um dado individual de paciente, o que contradiz a política de dados da clínica.
**Conteúdo:**
> Os bebês realizaram testes da linguinha, ouvido, pezinho e olho; acompanhamento inicial foi na Maternidade Marly Sarney em São Luiz.
> 
> ## Contexto
> - Categoria: [[_moc-protocolo-clinico|Protocolos Clinicos]]

### `regra-negocio/a-clinica-altera-o-valor-da-consulta-de-pediatria-de-rn-para-valor-comum-mais-c`
**Tipo:** regra_negocio
**Motivo:** O valor da consulta padrão (R$ 500,00) é *menor* que o valor para bebês até 2 meses (R$ 800,00), portanto, a afirmação 'mais caro' está incorreta.
**Conteúdo:**
> A clínica altera o valor da consulta de Pediatria de RN para valor comum (mais caro) quando o bebê completa 2 meses.
> 
> ## Contexto
> - Categoria: [[_moc-regra-negocio|Regras de Negocio]]
> - Temas: [[_tema-politica-de-precificacao-e-reajustes|Política de Precificação e Reajustes]]

### `padrao-comportamental/a-clinica-oferece-um-pacote-premium-de-check-up-neonatal-r-120000-que-inclu`
**Tipo:** padrao_comportamental
**Motivo:** O contexto oficializa o 'Check-up neonatal / bebê até 2 meses' por R$ 800,00, contradizendo o valor de R$ 1.200,00 para um 'pacote premium' não listado.
**Conteúdo:**
> A clínica oferece um pacote premium de Check-up Neonatal (R$ 1.200,00) que inclui diversos testes, porém o fluxo de conversão parece ser interrompido após o envio de documentos técnicos e áudios, sem um fechamento claro de agendamento.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/a-familia-prefere-atendimentos-onde-o-pai-a-condicao-da-mae`
**Tipo:** padrao_comportamental
**Motivo:** Esta memória descreve uma preferência específica de uma família individual, o que é considerado dado de paciente individual.
**Conteúdo:**
> A família prefere atendimentos onde o pai à condição da mãe.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/a-familia-viaja-para-bacabal-todas-as-semanas-de-segunda-a-quinta-feira-restrin`
**Tipo:** padrao_comportamental
**Motivo:** Esta memória descreve uma restrição logística específica de uma família individual, o que é considerado dado de paciente individual.
**Conteúdo:**
> A família viaja para Bacabal todas as semanas de segunda a quinta-feira, restringindo agendamentos para sextas ou datas específicas.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/a-flexibilidade-no-valor-da-consulta-para-pagamentos-em-especie-dinheiro-demon`
**Tipo:** padrao_comportamental
**Motivo:** O contexto não menciona flexibilidade ou desconto no valor da consulta para pagamentos em espécie, contradizendo os preços oficiais.
**Conteúdo:**
> A flexibilidade no valor da consulta para pagamentos em espécie (dinheiro) demonstra ser um gatilho de conversão eficiente para pacientes que questionam o preço inicial.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/a-gestao-de-multiplos-pacientes-valentina-tailla-e-aylla-em-um-unico-contato`
**Tipo:** padrao_comportamental
**Motivo:** A menção de nomes específicos de pacientes (Valentina, Tailla e Aylla) indica um dado individual de paciente, não um padrão comportamental geral.
**Conteúdo:**
> A gestão de múltiplos pacientes (Valentina, Tailla e Aylla) em um único contato exige que a secretária seja muito clara ao enviar orçamentos e resultados para evitar confusão por parte do responsável.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/a-mae-e-extremamente-flexivel-com-horarios-aceitando-qualquer-disponibilidade-d`
**Tipo:** padrao_comportamental
**Motivo:** A memória se refere a uma 'mãe' específica, indicando um dado individual de paciente, não um padrão comportamental geral.
**Conteúdo:**
> A mãe é extremamente flexível com horários, aceitando qualquer disponibilidade da médica.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/a-oferta-de-parcelamento-foi-o-fator-determinante-para-reverter-a-objecao-de-pre`
**Tipo:** padrao_comportamental
**Motivo:** O contexto não menciona a oferta de parcelamento como forma de pagamento, contradizendo as informações financeiras fornecidas.
**Conteúdo:**
> A oferta de parcelamento foi o fator determinante para reverter a objeção de preço e converter o agendamento imediato.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/a-paciente-e-advogada-karine-dantas-e-possui-horarios-de-atendimento-comercial`
**Tipo:** padrao_comportamental
**Motivo:** Contém dados individuais e específicos de uma paciente (nome, profissão, horários, locais de atuação), o que não é um padrão comportamental generalizável.
**Conteúdo:**
> A paciente é advogada (Karine Dantas) e possui horários de atendimento comercial rígidos (08:00 às 17:30) e atua em Lago da Pedra e Rio Maria-PA.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/agatha-vilany-estava-na-lista-de-urgencia-da-dra-fernanda-santana`
**Tipo:** padrao_comportamental
**Motivo:** Esta memória contém dados de paciente individual (Agatha Vilany), não sendo um padrão comportamental generalizável.
**Conteúdo:**
> Agatha Vilany estava na lista de urgência da Dra. Fernanda Santana.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/arthur-benicio-pereira-de-jesus-ja-realizou-consultas-anteriores-com-a-dra-fern`
**Tipo:** padrao_comportamental
**Motivo:** Esta memória contém dados de paciente individual (Arthur Benício Pereira de Jesus), não sendo um padrão comportamental generalizável.
**Conteúdo:**
> Arthur Benício Pereira de Jesus já realizou consultas anteriores com a Dra. Fernanda Santana.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]
> - Temas: [[_tema-continuidade-do-cuidado-e-preferencia-por-profissionais|Continuidade do Cuidado e Preferência por Profissionais]]

### `padrao-comportamental/as-pacientes-ana-cecilia-e-nayra-vitoria-sao-irmas-e-ja-possuem-historico-com-a`
**Tipo:** padrao_comportamental
**Motivo:** Esta memória contém dados de pacientes individuais (Ana Cecília e Nayra Vitória), não sendo um padrão comportamental generalizável.
**Conteúdo:**
> As pacientes Ana Cecília e Nayra Vitória são irmãs e já possuem histórico com a Dra. Fernanda Santana.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/carla-andreza-e-prima-de-jader-e-possui-proximidade-com-a-dra-fernanda`
**Tipo:** padrao_comportamental
**Motivo:** Esta memória contém dados de paciente individual (Carla Andreza e Jáder), não sendo um padrão comportamental generalizável.
**Conteúdo:**
> Carla Andreza é prima de Jáder e possui proximidade com a Dra. Fernanda.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/dra-fernanda-ficou-de-enviar-a-foto-do-sabonete-dermacyd-baby-para-a-mae`
**Tipo:** padrao_comportamental
**Motivo:** Esta memória contém dados de interação individual entre a médica e uma mãe específica, não sendo um padrão comportamental generalizável.
**Conteúdo:**
> Dra. Fernanda ficou de enviar a foto do sabonete Dermacyd Baby para a mãe.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/horario-de-atendimento-da-paciente-e-das-0800-as-1200-e-1400-as-1700`
**Tipo:** padrao_comportamental
**Motivo:** Esta memória se refere a um horário de atendimento específico de 'da paciente', indicando ser um dado individual de paciente e não um padrão comportamental geral ou política da clínica.
**Conteúdo:**
> Horário de atendimento da paciente é das 08:00 às 12:00 e 14:00 às 17:00.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/identificada-a-necessidade-de-flexibilidade-para-conversao-de-consultas-de-retor`
**Tipo:** padrao_comportamental
**Motivo:** A memória sugere a necessidade de telemedicina para retornos, o que contradiz diretamente a política da clínica de 'sem telemedicina' para atendimento presencial, exceto nutrição.
**Conteúdo:**
> Identificada a necessidade de flexibilidade para conversão de consultas de retorno presenciais em telemedicina por solicitação do paciente.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/miguel-apresenta-quadro-de-febre-vomito-e-abdomen-inchado`
**Tipo:** padrao_comportamental
**Motivo:** Contém dados de saúde específicos de um paciente individual ('Miguel'), o que não deve ser generalizado como padrão comportamental.
**Conteúdo:**
> Miguel apresenta quadro de febre, vômito e abdômen inchado.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]
> - Temas: [[_tema-gestao-de-urgencias-e-sintomas-agudos|Gestão de Urgências e Sintomas Agudos]]

### `padrao-comportamental/necessario-repetir-exame-de-ultrassom-em-3-meses`
**Tipo:** padrao_comportamental
**Motivo:** Parece ser uma recomendação médica específica para um paciente individual, não um padrão comportamental geral ou política da clínica.
**Conteúdo:**
> Necessário repetir exame de ultrassom em 3 meses.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]
> - Temas: [[_tema-protocolos-de-exames-e-triagem-neonatal|Protocolos de Exames e Triagem Neonatal]]

### `padrao-comportamental/novo-valor-de-consulta-de-r-50000-estabelecido-a-partir-de-fevereiro-de-2026`
**Tipo:** padrao_comportamental
**Motivo:** O contexto oficial estabelece que a consulta pediátrica padrão é R$ 500,00, enquanto a memória indica que este é um 'novo valor' a partir de fevereiro de 2026, contradizendo a informação atual.
**Conteúdo:**
> Novo valor de consulta de R$ 500,00 estabelecido a partir de fevereiro de 2026.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/o-paciente-e-acompanhado-pela-dra-fernanda`
**Tipo:** padrao_comportamental
**Motivo:** A memória 'O paciente é acompanhado pela Dra. Fernanda' parece ser um dado individual de paciente, não um padrão comportamental generalizado, o que contradiz a diretriz de evitar dados individuais.
**Conteúdo:**
> O paciente é acompanhado pela Dra. Fernanda.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/o-sr-antonio-realizou-pagamento-parcial-de-35000-em-especie-restando-15000-p`
**Tipo:** padrao_comportamental
**Motivo:** Esta memória contém dados específicos de um paciente individual (Sr. Antonio e detalhes de pagamento), não um padrão comportamental geral da clínica.
**Conteúdo:**
> O Sr. Antonio realizou pagamento parcial de 350,00 em espécie, restando 150,00 para quitação via Pix.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/os-exames-de-vitamina-c-e-zinco-de-valentina-brito-silva-ainda-estao-pendentes`
**Tipo:** padrao_comportamental
**Motivo:** Contém dados específicos de um paciente individual ('Valentina Brito Silva') e seu status de exames, não um padrão comportamental generalizável.
**Conteúdo:**
> Os exames de Vitamina C e Zinco de Valentina Brito Silva ainda estão pendentes, enquanto os demais já foram concluídos.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]
> - Temas: [[_tema-protocolos-de-exames-e-triagem-neonatal|Protocolos de Exames e Triagem Neonatal]]

### `padrao-comportamental/paciente-3-meses-e-21-dias`
**Tipo:** padrao_comportamental
**Motivo:** Contém dados específicos de idade de um paciente individual, não um padrão comportamental generalizável.
**Conteúdo:**
> Paciente 3 meses e 21 dias.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/paciente-e-atendida-na-clinica-pelo-dr-daniel-ginecologista`
**Tipo:** padrao_comportamental
**Motivo:** Menciona um médico (Dr. Daniel, Ginecologista) que não faz parte da equipe oficial da clínica fornecida no contexto.
**Conteúdo:**
> Paciente é atendida na clínica pelo Dr. Daniel (Ginecologista).
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/paciente-nascido-de-24-dias-que-ja-realizou-os-testes-obrigatorios`
**Tipo:** padrao_comportamental
**Motivo:** Contém dados específicos de idade e status de testes de um paciente individual, não um padrão comportamental generalizável.
**Conteúdo:**
> Paciente-nascido de 24 dias que já realizou os testes obrigatórios.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/paciente-nascido-prematuro-35-semanas-com-necessidade-de-urgencia-para-liberac`
**Tipo:** padrao_comportamental
**Motivo:** Contém dados específicos de um paciente individual (idade gestacional, urgência), não um padrão comportamental generalizável.
**Conteúdo:**
> Paciente-nascido prematuro (35 semanas) com necessidade de urgência para liberação de alta hospitalar.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

### `padrao-comportamental/wilson-davi-pereira-carvalho-ja-e-paciente-mas-esta-e-sua-primeira-consulta-com`
**Tipo:** padrao_comportamental
**Motivo:** Contém dados individuais de paciente (nome e histórico de consulta), o que contradiz a política de não incluir dados individuais.
**Conteúdo:**
> Wilson Davi Pereira Carvalho já é paciente, mas esta é sua primeira consulta com a Dra. Fernanda.
> 
> ## Contexto
> - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

---

## ⚠️ SUSPEITAS — Revisar antes de confiar

### padrao_comportamental (36)

**`a-clinica-implementou-um-reajuste-no-valor-das-consultas-para-r-50000-a-partir`**
*O contexto lista R$ 500,00 como o preço padrão atual da consulta, não necessariamente um reajuste 'a partir de fevereiro de 2026', o que pode ser uma imprecisão na data do reajuste.*
> A clínica implementou um reajuste no valor das consultas para R$ 500,00 a partir de fevereiro de 2026, o que deve ser monitorado como possível ponto de objeção em novos agendamentos.  ## Contexto - Ca

**`a-clinica-nao-permite-o-reagendamento-de-consultas-de-retorno-conforme-informad`**
*O contexto afirma que o retorno 'NÃO é agendado por WhatsApp/chat — apenas pela médica na consulta', mas não proíbe explicitamente o reagendamento de forma geral.*
> A clínica não permite o reagendamento de consultas de retorno, conforme informado pela assistente Joana Victória.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

**`a-clinica-nao-realiza-o-teste-do-coracaozinho-apenas-o-do-olhinho`**
*O contexto menciona 'Check-up neonatal / bebê até 2 meses (inclui testes)' mas não especifica quais testes são ou não realizados, tornando esta informação não verificável.*
> A clínica não realiza o teste do coraçãozinho, apenas o do olhinho.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

**`a-clinica-nao-realiza-o-teste-do-coracaozinho`**
*O contexto menciona 'Check-up neonatal / bebê até 2 meses (inclui testes)' mas não especifica quais testes são ou não realizados, tornando esta informação não verificável.*
> A clínica não realiza o teste do coraçãozinho.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

**`a-clinica-possui-um-modelo-de-parceria-com-profissionais-de-saude-baseado-em-rep`**
*Esta é uma informação sobre o modelo de negócio interno da clínica que não está presente no contexto fornecido e, portanto, não pode ser verificada.*
> A clínica possui um modelo de parceria com profissionais de saúde baseado em repasse percentual (70%) sobre procedimentos realizados em dias específicos (sábados).  ## Contexto - Categoria: [[_moc-pad

**`a-clinica-possui-uma-politica-de-precificacao-diferenciada-por-faixa-etaria-o-v`**
*A memória confunde o 'Check-up neonatal / bebê até 2 meses (inclui testes)' de R$ 800,00 com uma 'consulta' para recém-nascidos, e o R$ 500,00 é o valor padrão da consulta, não necessariamente um valor 'reduzido' após 2 meses.*
> A clínica possui uma política de precificação diferenciada por faixa etária: o valor da consulta é de R$ 800,00 para recém-nascidos, reduzindo para R$ 500,00 após os 2 meses de vida.  ## Contexto - Ca

**`a-clinica-realiza-atendimentos-pelo-convenio-lagoa-grande`**
*O contexto não menciona nenhum convênio ou plano de saúde, tornando esta informação não verificável.*
> A clínica realiza atendimentos pelo convênio Lagoa Grande.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

**`a-consulta-de-500-reais-da-dra-fernanda-santana-inclui-acompanhamento-mensal-at`**
*A inclusão de 'até 2 retornos' na consulta de R$500 não é explicitamente confirmada pelo contexto, que menciona um valor para retorno a partir de 2026, necessitando de esclarecimento.*
> A consulta de 500 reais da Dra Fernanda Santana inclui acompanhamento mensal, até 2 retornos dependendo do caso, sistema de tira-dúvidas e acompanhamento de marcos de desenvolvimento.  ## Contexto - C

**`a-consulta-inclui-os-testes-obrigatorios-de-linguinha-e-olhinho`**
*É ambíguo se 'A consulta' se refere à consulta padrão de R$500 ou ao check-up neonatal de R$800, que explicitamente inclui testes.*
> A consulta inclui os testes obrigatórios de linguinha e olhinho.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]] - Temas: [[_tema-protocolos-de-exames-e-triagem-neonat

**`a-dra-informou-que-nao-realizara-atendimentos-na-segunda-feira-o-que-demanda-u`**
*A identidade de 'A Dra.' é ambígua; se for Dra. Fabíola, contradiz sua disponibilidade às segundas, ou se for Dra. Fernanda, pode implicar uma indisponibilidade mais ampla do que a especificada.*
> A Dra. informou que não realizará atendimentos na segunda-feira, o que demanda uma verificação imediata na agenda para remanejamento de pacientes e bloqueio de horários.  ## Contexto - Categoria: [[_m

**`a-flexibilidade-em-oferecer-horarios-alternativos-como-turnos-de-sabado-para-p`**
*A clínica não menciona turnos de sábado ou especialistas externos no contexto fornecido, tornando a generalização suspeita.*
> A flexibilidade em oferecer horários alternativos (como turnos de sábado) para pacientes que viajam para consultas com especialistas externos é um fator determinante para a manutenção da adesão ao tra

**`a-flexibilidade-no-horario-para-respeitar-o-sono-da-crianca-foi-determinante-par`**
*A menção de diagnósticos cirúrgicos específicos como hidrocele e 'fluxo de nutrição pós-consulta' parece ser um dado individual de paciente ou uma observação médica específica, não um padrão comportamental geral.*
> A flexibilidade no horário para respeitar o sono da criança foi determinante para a realização da consulta. Diagnósticos cirúrgicos como hidrocele exigem um fluxo de nutrição pós-consulta mais próximo

**`a-paciente-a-modalidade-de-retorno-online`**
*A memória está incompleta e, se sugere retorno online, contradiz a política de que retornos não são agendados por WhatsApp/chat.*
> A paciente a modalidade de retorno online.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

**`a-paciente-e-advogada`**
*Embora mais genérica, ainda se refere a uma característica individual de um paciente específico, não a um padrão comportamental amplo.*
> A paciente é advogada.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

**`a-paciente-e-depende-de-transporte-que-circula-apenas-no-periodo-da-manha`**
*Descreve uma situação logística específica de um paciente, não um padrão comportamental generalizado da base de pacientes.*
> A paciente e depende de transporte que circula apenas no período da manhã.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

**`a-paciente-e-rio-maria-pa`**
*Refere-se à localização específica de um paciente, não a um padrão comportamental generalizado.*
> A paciente e Rio Maria-PA.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

**`a-responsavel-mesmo-dia-devido-a-logistica-de-viagem`**
*A memória está incompleta e, se refere a uma responsável específica, é dado individual; se é um padrão, está mal formulado.*
> A responsável (mesmo dia) devido à logística de viagem.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

**`dra-fernanda-santana-atende-apenas-no-turno-da-manha`**
*O contexto fornecido não confirma que a Dra. Fernanda Santana atende apenas no turno da manhã, tornando esta informação uma observação não verificada.*
> Dra. Fernanda Santana atende apenas no turno da manhã.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

**`em-casos-de-urgencia-o-paciente-o-atendimento`**
*A memória está incompleta e gramaticalmente incorreta, tornando impossível determinar seu significado ou validade como padrão comportamental.*
> Em casos de urgência, o paciente o atendimento.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

**`identificada-a-necessidade-de-agilidade-na-oferta-de-horarios-de-retorno-quando`**
*A memória sugere que a 'marcação' de retornos pode ficar pendente, o que pode conflitar com a política de que o retorno é agendado 'apenas pela médica na consulta', e não pela recepção ou sistema.*
> Identificada a necessidade de agilidade na oferta de horários de retorno quando solicitados na sexta-feira, para evitar que a marcação fique pendente durante o final de semana e garantir a ocupação da

**`identificada-divergencia-de-informacoes-sobre-o-horario-de-inicio-do-atendimento`**
*Contradiz o horário oficial de início do atendimento (08:30) com uma informação de 09:00, indicando uma possível falha de comunicação que precisa ser revisada.*
> Identificada divergência de informações sobre o horário de início do atendimento na mesma interação (08:30 vs 09:00), o que pode causar confusão e insatisfação no paciente.  ## Contexto - Categoria: [

**`joana-victoria-atua-como-assistente-da-dra-fernanda-santana-no-centro-medico-ali`**
*O contexto oficial apenas informa que Joana Vitória é secretária, não especificando que ela atua como assistente da Dra. Fernanda Santana.*
> Joana Victória atua como assistente da Dra Fernanda Santana no Centro Médico Aliança Kids.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]] - Temas: [[_tema-continuidad

**`joana-victoria-e-a-assistente-da-dra-fernanda-santana`**
*O contexto oficial apenas informa que Joana Vitória é secretária, não especificando que ela é a assistente da Dra. Fernanda Santana.*
> Joana Victória é a assistente da Dra Fernanda Santana.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]] - Temas: [[_tema-continuidade-do-cuidado-e-preferencia-por-profi

**`o-envio-de-resultados-de-exames-via-whatsapp-e-um-ponto-de-contato-frequente-que`**
*A política afirma que resultados anômalos não são enviados por chat, o que torna suspeita a afirmação de que o envio de resultados de exames via WhatsApp é um 'ponto de contato frequente' de forma geral.*
> O envio de resultados de exames via WhatsApp é um ponto de contato frequente que exige um protocolo claro de confirmação de recebimento e proatividade na oferta de agendamento de retorno para análise 

**`o-paciente-a-dra-dayse`**
*A Dra. Dayse não está listada na equipe oficial da clínica, o que levanta dúvidas sobre a veracidade ou relevância dessa informação no contexto atual.*
> O paciente a Dra. Dayse.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

**`o-paciente-a-reputacao-da-medica-perguntando-sobre-seu-vinculo-familiar-com-outr`**
*O Dr. Rafael não está listado na equipe oficial da clínica, o que levanta dúvidas sobre a veracidade ou relevância dessa informação no contexto atual.*
> O paciente a reputação da médica perguntando sobre seu vínculo familiar com outro profissional (Dr. Rafael).  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

**`o-paciente-mas-a-clinica-restringiu-os-retornos-ao-periodo-da-tarde-o-que-pode`**
*A restrição de retornos ao período da tarde não está documentada nas políticas da clínica, podendo ser uma exceção ou informação desatualizada.*
> O paciente, mas a clínica restringiu os retornos ao período da tarde, o que pode ser um ponto de atrito para pais que trabalham.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comporta

**`o-paciente-o-agendamento-mesmo-com-a-politica-da-clinica-de-informar-o-horario-e`**
*A política de informar o horário exato apenas um dia antes não está documentada no contexto fornecido da clínica.*
> O paciente o agendamento mesmo com a política da clínica de informar o horário exato apenas um dia antes, demonstrando alta confiança ou urgência no atendimento.  ## Contexto - Categoria: [[_moc-padra

**`o-paciente-o-pacote-de-r-75000-pediatra-nutricionista-ao-entender-que-pode`**
*O pacote de R$ 750,00 (Pediatra + Nutricionista) não está documentado nos preços oficiais ou serviços da clínica.*
> O paciente o pacote de R$ 750,00 (Pediatra + Nutricionista) ao entender que poderia realizar apenas a consulta de acompanhamento simples.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes

**`o-pacientevendas-o-que-pode-gerar-mensagens-irrelevantes-no-historico-da-clini`**
*A memória está incompleta, tornando seu significado e utilidade incertos.*
> O paciente/vendas, o que pode gerar mensagens irrelevantes no histórico da clínica e exige atenção da secretária para filtrar o que é dúvida real.  ## Contexto - Categoria: [[_moc-padrao-comportamenta

**`o-processo-de-coleta-de-dados-cadastrais-em-bloco-antes-da-confirmacao-final-do`**
*A memória está incompleta, tornando seu significado e utilidade incertos.*
> O processo de coleta de dados cadastrais em bloco antes da confirmação final do encaixe mostrou-se eficiente, com o paciente.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamen

**`o-responsavel-a-em-recem-nascidos`**
*A memória está incompleta e carece de significado claro.*
> O responsável A em recém-nascidos.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

**`o-responsavel-as-1400-necessitando-de-atendimentos-matinais-ou-com-horarios-ri`**
*A memória está incompleta, tornando seu significado e utilidade incertos.*
> O responsável às 14:00, necessitando de atendimentos matinais ou com horários rigorosos.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]]

**`o-responsavel-o-atendimento-estiver-proximo-para-evitar-tempo-de-espera-excessiv`**
*A memória está incompleta, tornando seu significado e utilidade incertos.*
> O responsável o atendimento estiver próximo para evitar tempo de espera excessivo no local.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]] - Temas: [[_tema-gestao-de-

**`paciente-o-reajuste-para-r-50000-se-aplicava-a-todas-as-consultas`**
*O valor de R$ 500,00 não se aplica a todas as consultas, havendo exceções como check-up neonatal (R$ 800,00) e consultas de segunda (R$ 400,00), tornando a generalização incorreta se interpretada como regra da clínica.*
> Paciente o reajuste para R$ 500,00 se aplicava a todas as consultas.  ## Contexto - Categoria: [[_moc-padrao-comportamental|Padroes Comportamentais]] - Temas: [[_tema-politica-de-precificacao-e-reajus

**`pacientes-demonstram-inseguranca-com-o-modelo-de-atendimento-por-ordem-de-chegad`**
*A política de 'ordem de chegada' e a de 'retorno agendado pela médica' podem gerar ambiguidade para o paciente, necessitando de esclarecimento sobre a aplicação em retornos.*
> Pacientes demonstram insegurança com o modelo de atendimento por ordem de chegada em retornos, especialmente quando há um quadro de ansiedade clínica ou preocupação com a saúde da criança, preferindo 

### regra_negocio (7)

**`a-clinica-oferece-valores-reduzidos-para-a-aquisicao-de-produtos-quando-vendidos`**
*O contexto não menciona a venda de 'produtos' ou 'combos', sendo uma informação nova e não confirmada.*
> A clínica oferece valores reduzidos para a aquisição de produtos quando vendidos em formato de combo.  ## Contexto - Categoria: [[_moc-regra-negocio|Regras de Negocio]] - Temas: [[_tema-politica-de-pr

**`a-politica-tarifaria-da-clinica-estabelece-o-valor-de-r-50000-para-consultas-p`**
*O valor de R$ 750,00 para consultas integradas com nutricionista não consta na lista de preços oficiais, embora a nutricionista seja mencionada.*
> A política tarifária da clínica estabelece o valor de R$ 500,00 para consultas pediátricas de rotina e R$ 750,00 para consultas integradas com nutricionista ou protocolos específicos de introdução ali

**`em-situacoes-excepcionais-de-impossibilidade-de-comparecimento-presencial-ou-urg`**
*A menção de 'análise de exames e emissão de prescrições via canais digitais' para urgências pode contradizer a política de 'sem telemedicina' para pacientes de outras cidades, exceto nutrição.*
> Em situações excepcionais de impossibilidade de comparecimento presencial ou urgências, a clínica adota protocolos de análise de exames e emissão de prescrições via canais digitais ou assistentes, alé

**`o-valor-da-consulta-foi-reajustado-para-r-50000-a-partir-de-fevereiro-de-2026`**
*O contexto informa que a consulta pediátrica padrão já custa R$ 500,00, não mencionando um reajuste futuro para este valor em fevereiro de 2026.*
> O valor da consulta foi reajustado para R$ 500,00 a partir de fevereiro de 2026.  ## Contexto - Categoria: [[_moc-regra-negocio|Regras de Negocio]] - Temas: [[_tema-politica-de-precificacao-e-reajuste

**`o-valor-da-ultrassom-e-r-18000-e-exige-jejum-para-realizacao`**
*O valor da ultrassom é R$ 180,00, mas a exigência de jejum não está mencionada no contexto fornecido.*
> O valor da ultrassom é R$ 180,00 e exige jejum para realização.  ## Contexto - Categoria: [[_moc-regra-negocio|Regras de Negocio]]

**`priorizar-a-oferta-de-horarios-extremos-primeiros-ou-ultimos-do-turno-ou-permi`**
*A memória sugere uma flexibilização ou exceção à política de 'ordem de chegada', que não está explicitamente definida no contexto como uma regra oficial.*
> Priorizar a oferta de horários extremos (primeiros ou últimos do turno) ou permitir espera remota para casos de recém-nascidos, crianças com alta irritabilidade ou restrições de horário escolar, visan

**`servicos-especializados-possuem-precificacao-superior-consultas-neonatais-para`**
*O contexto confirma R$ 800,00 para check-up neonatal, mas não a variação até R$ 1.200,00 nem o valor de R$ 750,00 para protocolos de introdução alimentar.*
> Serviços especializados possuem precificação superior: consultas neonatais para bebês com menos de 2 meses ou que incluem triagens (testes do olhinho, linguinha, orelhinha e pezinho) variam de R$ 800,

### processo_operacional (7)

**`agendamentos-para-o-dr-tiago-nobre-otorrino-exigem-alinhamento-previo-do-caso`**
*O contexto não menciona a exigência de alinhamento prévio do caso clínico para agendamentos com o Dr. Tiago Nobre.*
> Agendamentos para o Dr. Tiago Nobre (Otorrino) exigem alinhamento prévio do caso clínico antes da confirmação.  ## Contexto - Categoria: [[_moc-processo-operacional|Processos Operacionais]]

**`as-consultas-com-a-nutricionista-parceira-dra-katia-franca-sao-realizadas-exc`**
*O contexto afirma que a Dra. Kátia França oferece telemedicina como exceção para pacientes de outras cidades, mas não que suas consultas são 'exclusivamente' online para todos.*
> As consultas com a nutricionista parceira (Dra. Katia França) são realizadas exclusivamente de forma online via vídeo chamada.  ## Contexto - Categoria: [[_moc-processo-operacional|Processos Operacion

**`o-atendimento-na-pediatria-do-centro-medico-alianca-e-realizado-por-ordem-de-che`**
*O contexto estabelece o sistema de ordem de chegada 'a partir das 08:30', enquanto a memória sugere um início 'entre 08:00 e 08:30', o que pode ser contraditório.*
> O atendimento na Pediatria do Centro Médico Aliança é realizado por ordem de chegada, com início das atividades no período da manhã (entre 08:00 e 08:30).  ## Contexto - Categoria: [[_moc-processo-ope

**`o-atendimento-para-retornos-e-realizado-por-ordem-de-chegada`**
*O contexto afirma que o retorno 'NÃO é agendado por WhatsApp/chat — apenas pela médica na consulta', o que sugere um processo diferente da simples 'ordem de chegada' para retornos.*
> O atendimento para retornos é realizado por ordem de chegada.  ## Contexto - Categoria: [[_moc-processo-operacional|Processos Operacionais]]

**`o-horario-padrao-de-inicio-dos-atendimentos-pediatricos-no-turno-matutino-e-esta`**
*O contexto indica que o sistema de ordem de chegada começa 'a partir das 08:30', o que torna o início dos atendimentos às 09:00 um pouco tardio ou uma informação não totalmente alinhada.*
> O horário padrão de início dos atendimentos pediátricos no turno matutino é estabelecido às 09:00.  ## Contexto - Categoria: [[_moc-processo-operacional|Processos Operacionais]] - Temas: [[_tema-gesta

**`os-retornos-da-dra-fernanda-santana-ocorrem-por-ordem-de-chegada-iniciando-as`**
*A memória detalha o fluxo de retornos de uma médica específica com horários de início (08:30 e 14:00) e 'ordem de chegada', o que não está explicitamente coberto pela política geral de retornos ('apenas pela médica na consulta').*
> Os retornos da Dra. Fernanda Santana ocorrem por ordem de chegada, iniciando às 08:30 no período da manhã e às 14:00 no período da tarde.  ## Contexto - Categoria: [[_moc-processo-operacional|Processo

**`priorizar-o-agendamento-de-consultas-no-inicio-dos-turnos-para-acompanhantes-que`**
*Contradiz a política de 'sistema de ordem de chegada a partir das 08:30' ao sugerir priorização de agendamento para casos específicos.*
> Priorizar o agendamento de consultas no início dos turnos para acompanhantes que possuam restrições de horário fixo ou limitações físicas temporárias, garantindo suporte logístico e pontualidade no at

### conhecimento_medico (1)

**`o-medicamento-flora-b-e-outros-produtos-do-mesmo-laboratorio-fabricante-encontra`**
*O contexto fornecido não inclui informações de conhecimento médico ou sobre a disponibilidade de medicamentos, impossibilitando a verificação desta informação.*
> O medicamento Flora B e outros produtos do mesmo laboratório fabricante encontram-se permanentemente indisponíveis no mercado devido à falência/interrupção das atividades da empresa, devendo ser subst

---

## ✅ OK — Aprovadas

- **padrao_comportamental:** 328 memórias
- **processo_operacional:** 30 memórias
- **regra_negocio:** 19 memórias
- **feedback_melhoria:** 8 memórias
- **protocolo_clinico:** 3 memórias
- **recurso_equipe:** 3 memórias

---

## Como agir

**ERRADAS:** fale para a Clara: *"corrija sua memória sobre [assunto]"* ou delete o arquivo em `clinica-vault/memories/`

**SUSPEITAS:** leia o conteúdo e decida se:
- Está correto → ignore
- Está errado → fale para Clara corrigir ou delete o arquivo
- É uma exceção válida → deixe como está (o Contradiction Guard já protege o Tier 1)