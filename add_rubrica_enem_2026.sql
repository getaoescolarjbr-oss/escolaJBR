-- Rubrica ENEM do sistema atualizada para a Cartilha do Participante 2026 (Inep).
-- Antes: C1 com limites inventados ("até 3", "até 5" desvios), C2 com descritores de edição antiga e sem regra de tetos.
-- Agora: descritores de 2026 e regras de decisão (nível inferior prevalece, tetos por tangência, cópia, condicional etc.).
-- Reversão: restaurar criterios/instrucoes de public.backup_rubrica_enem_20261023.
create table if not exists public.backup_rubrica_enem_20261023 as
  select * from public.rubricas_redacao where sistema is true and nome = 'ENEM';
alter table public.backup_rubrica_enem_20261023 enable row level security;

update public.rubricas_redacao
set criterios = jsonb_build_array(
  jsonb_build_object('chave','c1','rotulo','C1 — Norma padrão da língua','max',200,'passo',40,'descritores',
    '200 = excelente domínio; desvios só como exceção e sem reincidência (no máximo 1 falha de sintaxe e 2 desvios, com períodos complexos). 160 = bom domínio, poucos desvios. 120 = domínio mediano, alguns desvios. 80 = domínio insuficiente: muitos desvios ou estrutura sintática deficitária. 40 = domínio precário, desvios frequentes e sistemáticos. 0 = desconhecimento da modalidade escrita. Gramática conta cada ocorrência; grafia, acento e hífen contam uma vez por palavra. Letra difícil não penaliza.'),
  jsonb_build_object('chave','c2','rotulo','C2 — Tema, tipo textual e repertório','max',200,'passo',40,'descritores',
    '200 = argumentação consistente, repertório legitimado, pertinente e PRODUTIVO (usado para sustentar o argumento) e excelente domínio do dissertativo-argumentativo. 160 = argumentação consistente e bom domínio, com proposição, argumentação e conclusão. 120 = argumentação previsível, domínio mediano; repertório só dos motivadores ou decorativo. 80 = cópia de trechos dos motivadores ou estrutura incompleta (partes embrionárias). 40 = tangencia o tema ou tem traços constantes de outro tipo textual. 0 = fuga ao tema ou não dissertativo-argumentativo (anula a redação).'),
  jsonb_build_object('chave','c3','rotulo','C3 — Projeto de texto e argumentos','max',200,'passo',40,'descritores',
    '200 = ideias relacionadas ao tema, consistentes e organizadas, com autoria (projeto de texto estratégico, desenvolvimento em todo o texto). 160 = organizadas, com indícios de autoria (projeto com poucas falhas, desenvolve a maior parte das ideias). 120 = limitadas aos motivadores e pouco organizadas (algumas falhas, desenvolve algumas ideias). 80 = desorganizadas ou contraditórias (muitas falhas, desenvolve uma só ideia). 40 = pouco relacionadas ao tema ou sem direção. 0 = não relacionadas ao tema. Vale o nível mais baixo entre projeto e desenvolvimento. Contradição grave: máximo 80.'),
  jsonb_build_object('chave','c4','rotulo','C4 — Coesão','max',200,'passo',40,'descritores',
    '200 = articula bem as partes, repertório diversificado de recursos coesivos, sem inadequação (operador argumentativo entre parágrafos em pelo menos 2 momentos e recurso coesivo em todo parágrafo). 160 = poucas inadequações (operador entre parágrafos em pelo menos 1 momento). 120 = presença regular, algumas repetições ou inadequações. 80 = presença pontual, muitas repetições ou inadequações; texto sem parágrafos não passa daqui. 40 = presença rara, excesso de repetições ou inadequações. 0 = não articula. Repetir palavra do tema é esperado; conector escrito errado é C1.'),
  jsonb_build_object('chave','c5','rotulo','C5 — Proposta de intervenção','max',200,'passo',40,'descritores',
    'Conte os elementos válidos da proposta mais completa: ação, agente, meio/modo, efeito/finalidade e detalhamento (cada tipo vale 1). 5 = 200, 4 = 160, 3 = 120, 2 = 80, 1 = 40. Constatar a falta de algo não é propor; agente vago ("alguém", "é preciso") não conta; "todos", "nós" e "as pessoas" contam. Proposta em oração condicional: máximo 80. Tangência ao tema: máximo 40. 0 = sem proposta, sem relação com o assunto, ou que desrespeita direitos humanos.')
),
instrucoes = 'Nota zero na redação inteira: até 7 linhas próprias (cópia dos motivadores não conta), fuga total ao tema, não ser dissertativo-argumentativo, identificação do autor no texto, parte deliberadamente desconectada do tema, texto ilegível. Tetos: tangência = C2, C3 e C5 no máximo 40; muita cópia dos motivadores = C2 até 80; texto sem parágrafos = C4 até 80; proposta em oração condicional = C5 até 80; contradição grave = C3 até 80. Quando o texto reúne características de dois níveis, vale o mais baixo; julgue pelo conjunto do texto, não por um desvio isolado.'
where sistema is true and nome = 'ENEM';
