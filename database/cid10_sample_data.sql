-- Dados de exemplo do CID-10 para testes
-- Execute este script após criar a tabela cid10
-- Para uso em produção, você precisará importar a lista completa do CID-10

INSERT INTO public.cid10 (code, description) VALUES
-- Capítulo I: Algumas doenças infecciosas e parasitárias (A00-B99)
('A09', 'Diarreia e gastroenterite de origem infecciosa presumível'),
('A09.0', 'Outras gastroenterites e colites infecciosas e as não especificadas'),
('A15', 'Tuberculose respiratória, com confirmação bacteriológica e histológica'),
('A15.0', 'Tuberculose pulmonar, com confirmação por exame microscópico da expectoração, com ou sem cultura'),

-- Capítulo II: Neoplasias (C00-D48)
('C50', 'Neoplasia maligna da mama'),
('C50.9', 'Neoplasia maligna da mama, não especificada'),
('D25', 'Leiomioma do útero'),
('D25.9', 'Leiomioma do útero, não especificado'),

-- Capítulo III: Doenças do sangue (D50-D89)
('D50', 'Anemia por deficiência de ferro'),
('D50.9', 'Anemia por deficiência de ferro não especificada'),

-- Capítulo IV: Doenças endócrinas (E00-E90)
('E10', 'Diabetes mellitus insulino-dependente'),
('E11', 'Diabetes mellitus não-insulino-dependente'),
('E11.9', 'Diabetes mellitus não-insulino-dependente - sem complicações'),
('E66', 'Obesidade'),
('E66.0', 'Obesidade devida a excesso de calorias'),
('E66.9', 'Obesidade não especificada'),
('E78', 'Distúrbios do metabolismo de lipoproteínas e outras lipidemias'),
('E78.0', 'Hipercolesterolemia pura'),
('E78.5', 'Hiperlipidemia não especificada'),

-- Capítulo V: Transtornos mentais (F00-F99)
('F32', 'Episódios depressivos'),
('F32.9', 'Episódio depressivo não especificado'),
('F41', 'Outros transtornos ansiosos'),
('F41.1', 'Ansiedade generalizada'),
('F41.9', 'Transtorno ansioso não especificado'),

-- Capítulo VI: Doenças do sistema nervoso (G00-G99)
('G43', 'Enxaqueca'),
('G43.9', 'Enxaqueca, sem especificação'),
('G47', 'Distúrbios do sono'),
('G47.0', 'Distúrbios do início e da manutenção do sono [insônias]'),

-- Capítulo IX: Doenças do aparelho circulatório (I00-I99)
('I10', 'Hipertensão essencial (primária)'),
('I11', 'Doença cardíaca hipertensiva'),
('I20', 'Angina pectoris'),
('I21', 'Infarto agudo do miocárdio'),
('I25', 'Doença isquêmica crônica do coração'),
('I50', 'Insuficiência cardíaca'),
('I50.0', 'Insuficiência cardíaca congestiva'),
('I50.9', 'Insuficiência cardíaca não especificada'),

-- Capítulo X: Doenças do aparelho respiratório (J00-J99)
('J00', 'Nasofaringite aguda [resfriado comum]'),
('J02', 'Faringite aguda'),
('J02.9', 'Faringite aguda não especificada'),
('J03', 'Amigdalite aguda'),
('J03.9', 'Amigdalite aguda não especificada'),
('J06', 'Infecções agudas das vias aéreas superiores de localizações múltiplas e não especificadas'),
('J06.9', 'Infecção aguda das vias aéreas superiores não especificada'),
('J18', 'Pneumonia por microorganismo não especificado'),
('J18.9', 'Pneumonia não especificada'),
('J20', 'Bronquite aguda'),
('J40', 'Bronquite não especificada como aguda ou crônica'),
('J42', 'Bronquite crônica não especificada'),
('J44', 'Outras doenças pulmonares obstrutivas crônicas'),
('J45', 'Asma'),
('J45.9', 'Asma não especificada'),

-- Capítulo XI: Doenças do aparelho digestivo (K00-K93)
('K21', 'Doença de refluxo gastroesofágico'),
('K21.9', 'Doença de refluxo gastroesofágico sem esofagite'),
('K29', 'Gastrite e duodenite'),
('K29.7', 'Gastrite não especificada'),
('K30', 'Dispepsia'),
('K52', 'Outras gastroenterites e colites não-infecciosas'),
('K52.9', 'Gastroenterite e colite não-infecciosas, não especificadas'),
('K58', 'Síndrome do cólon irritável'),
('K58.0', 'Síndrome do cólon irritável com diarreia'),
('K58.9', 'Síndrome do cólon irritável sem diarreia'),
('K59', 'Outros transtornos funcionais do intestino'),
('K59.0', 'Constipação'),
('K59.1', 'Diarreia funcional'),
('K80', 'Colelitíase [cálculo da vesícula biliar]'),

-- Capítulo XII: Doenças da pele (L00-L99)
('L20', 'Dermatite atópica'),
('L30', 'Outras dermatites'),
('L30.9', 'Dermatite não especificada'),
('L50', 'Urticária'),
('L50.9', 'Urticária não especificada'),

-- Capítulo XIII: Doenças do sistema osteomuscular (M00-M99)
('M19', 'Outras artroses'),
('M19.9', 'Artrose não especificada'),
('M25', 'Outros transtornos articulares não classificados em outra parte'),
('M25.5', 'Dor articular'),
('M54', 'Dorsalgia'),
('M54.5', 'Dor lombar baixa'),
('M79', 'Outros transtornos dos tecidos moles, não classificados em outra parte'),
('M79.1', 'Mialgia'),

-- Capítulo XIV: Doenças do aparelho geniturinário (N00-N99)
('N39', 'Outros transtornos do trato urinário'),
('N39.0', 'Infecção do trato urinário de localização não especificada'),
('N76', 'Outras afecções inflamatórias da vagina e da vulva'),
('N76.0', 'Vaginite aguda'),

-- Capítulo XVIII: Sintomas e sinais (R00-R99)
('R05', 'Tosse'),
('R06', 'Anormalidades da respiração'),
('R06.0', 'Dispneia'),
('R07', 'Dor de garganta e no peito'),
('R07.0', 'Dor de garganta'),
('R10', 'Dor abdominal e pélvica'),
('R10.4', 'Outras dores abdominais e as não especificadas'),
('R11', 'Náusea e vômitos'),
('R50', 'Febre de origem desconhecida'),
('R50.9', 'Febre não especificada'),
('R51', 'Cefaleia'),
('R53', 'Mal estar, fadiga'),

-- Capítulo XIX: Lesões e envenenamentos (S00-T98)
('S06', 'Traumatismo intracraniano'),
('S82', 'Fratura da perna, incluindo tornozelo'),
('T14', 'Traumatismo de região não especificada do corpo'),
('T78', 'Efeitos adversos não classificados em outra parte'),

-- Capítulo XXI: Fatores que influenciam o estado de saúde (Z00-Z99)
('Z00', 'Exame geral e investigação de pessoas sem queixas ou diagnóstico relatado'),
('Z00.0', 'Exame médico geral'),
('Z01', 'Outros exames e investigações especiais de pessoas sem queixa ou diagnóstico relatado'),
('Z23', 'Necessidade de imunização contra doença bacteriana isolada'),
('Z30', 'Anticoncepção'),
('Z76', 'Pessoas em contato com os serviços de saúde em outras circunstâncias'),
('Z76.2', 'Supervisão de saúde de criança ou recém-nascido')

ON CONFLICT (code) DO NOTHING;

-- Mensagem de sucesso
SELECT 'CID-10: ' || COUNT(*) || ' códigos inseridos com sucesso!' as resultado
FROM public.cid10;
