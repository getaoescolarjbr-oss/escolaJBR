-- ====================================================================================
-- Cartão-resposta JUNTO com a prova por padrão.
--
-- provas.cartao_separado nasceu com DEFAULT true em create_correcao_omr.sql, na suposição
-- de que a folha exclusiva seria sempre a melhor para a leitura por câmera. O uso em sala
-- mostrou que não compensa: o cartão cabia na sobra da última página da prova e ia para
-- uma folha nova assim mesmo, gastando uma folha a mais por aluno — numa turma de 30, é
-- uma resma a cada poucas avaliações. A leitura funciona igual nos dois formatos, desde
-- que o cartão saia inteiro numa página só (garantido no CSS por break-inside: avoid).
--
-- Além do DEFAULT, as provas criadas ANTES desta mudança também são normalizadas. O
-- valor true nelas nunca foi uma escolha: era o default antigo, e a interface o
-- apresentava como uma caixa já marcada. Deixá-las como estavam fazia a tela de
-- impressão continuar abrindo em "folha separada" mesmo depois de o padrão virar, que
-- foi exatamente o que o professor relatou ao imprimir.
--
-- O recorte por data é o que torna isto seguro de reaplicar: uma prova criada depois,
-- em que o professor escolheu "separado" de propósito, não é tocada.
-- ====================================================================================

ALTER TABLE public.provas ALTER COLUMN cartao_separado SET DEFAULT false;

UPDATE public.provas
   SET cartao_separado = false
 WHERE cartao_separado
   AND created_at < DATE '2026-09-02';
