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
-- Só o DEFAULT muda. As provas já criadas ficam como estão: mexer nelas trocaria o layout
-- de avaliações possivelmente já impressas, e o professor pode alternar a qualquer momento
-- na própria tela de impressão.
-- ====================================================================================

ALTER TABLE public.provas ALTER COLUMN cartao_separado SET DEFAULT false;
