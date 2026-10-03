import {
  FOLHA_REDACAO_CAIXA,
  FOLHA_REDACAO_MARCA_MM,
  FOLHA_REDACAO_MARCAS,
  FOLHA_REDACAO_PASSO_LINHA_MM,
  LINHAS_FOLHA_REDACAO,
} from '../../../utils/folhaRedacao';

// A FOLHA DE REDAÇÃO de UM aluno (30 linhas, estilo ENEM). Mesmo componente na tela e no
// papel, como o CartaoRespostaFolha. Posições em mm vêm de utils/folhaRedacao.ts, as mesmas
// que a leitura por câmera vai usar para recortar a caixa de texto.
//
// Nome, turma e QR ficam fora da caixa de texto de propósito: o recorte que vai para a
// transcrição não leva dado pessoal. O texto do aluno nunca deve ser escrito perto das
// quatro marcas pretas dos cantos.

interface Props {
  aluno: {
    nome: string;
    numeroChamada: number | null;
    codigoSgde: string | null;
    turma: string | null;
    serie: string | null;
  };
  versao: string;
  /** Data URL do QR já gerado (mesmo código da folha da prova deste aluno). */
  qrDataUrl: string;
  titulo: string;
  tema: string | null;
  dataAplicacao: string;
  /** Número da questão de redação na prova, para o caso de haver mais de uma. */
  numeroQuestao?: number;
}

const mm = (v: number) => `${v}mm`;

const INSTRUCOES: Array<[string, string]> = [
  ['1', 'Escreva à tinta preta ou azul, com letra legível, dentro das linhas e respeitando as margens.'],
  ['2', 'Para corrigir, risque a palavra com um traço simples e escreva o substituto em seguida.'],
  ['3', 'Não escreva nome, assinatura ou marcas no texto. Não escreva sobre os quadrados pretos. Não dobre a folha.'],
  ['4', 'Texto com até 7 linhas, fuga ao tema ou desrespeito aos direitos humanos podem zerar a redação.'],
];

export function FolhaRedacaoJBR({ aluno, versao, qrDataUrl, titulo, tema, dataAplicacao, numeroQuestao }: Props) {
  const c = FOLHA_REDACAO_CAIXA;
  const sgde = aluno.codigoSgde ? `${aluno.codigoSgde}-${versao}` : `Versão ${versao}`;

  return (
    <div className="folha-red">
      {FOLHA_REDACAO_MARCAS.map((m, i) => (
        <div
          key={i}
          className="folha-red-marca"
          style={{ left: mm(m.x), top: mm(m.y), width: mm(FOLHA_REDACAO_MARCA_MM), height: mm(FOLHA_REDACAO_MARCA_MM) }}
        />
      ))}

      {/* Cabeçalho: logo, escola, aluno e QR */}
      <img
        src={`${window.location.origin}/logo.png.png`}
        alt=""
        className="folha-red-abs"
        style={{ left: mm(14), top: mm(12), width: mm(22), height: mm(22), objectFit: 'contain' }}
      />
      <div className="folha-red-abs" style={{ left: mm(40), top: mm(12), width: mm(118) }}>
        <div className="folha-red-escola">E.E. José Barbosa Rodrigues</div>
        <div className="folha-red-titulo">FOLHA DE REDAÇÃO{numeroQuestao ? ` — Questão ${numeroQuestao}` : ''}</div>
        <div className="folha-red-dados">
          Aluno(a): <strong>{aluno.nome}</strong>
          <br />
          {aluno.serie ? `${aluno.serie} — ` : ''}Turma {aluno.turma ?? '—'}
          {aluno.numeroChamada != null ? ` · Nº ${aluno.numeroChamada}` : ''} · SGDE {sgde} · {dataAplicacao}
        </div>
      </div>
      <img src={qrDataUrl} alt="" className="folha-red-abs" style={{ left: mm(162), top: mm(12), width: mm(24), height: mm(24) }} />

      <div className="folha-red-abs folha-red-dados" style={{ left: mm(14), top: mm(38.5), width: mm(172) }}>
        <strong>{titulo}</strong>
        {tema ? ` — Tema: ${tema}` : ''}
      </div>

      {/* Caixa das 30 linhas */}
      <div
        className="folha-red-caixa"
        style={{ left: mm(c.x), top: mm(c.y), width: mm(c.largura), height: mm(c.altura) }}
      >
        <div className="folha-red-gutter" style={{ width: mm(c.gutter) }} />
        {Array.from({ length: LINHAS_FOLHA_REDACAO }, (_, i) => (
          <div key={i}>
            {i > 0 && (
              <div
                className="folha-red-linha"
                style={{ top: mm(i * FOLHA_REDACAO_PASSO_LINHA_MM) }}
              />
            )}
            <div
              className="folha-red-num"
              style={{
                top: mm(i * FOLHA_REDACAO_PASSO_LINHA_MM + FOLHA_REDACAO_PASSO_LINHA_MM / 2 - 1.3),
                width: mm(c.gutter),
              }}
            >
              {i + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Rodapé: instruções e quadro de correção (competências) */}
      <div className="folha-red-abs folha-red-instr" style={{ left: mm(14), top: mm(245), width: mm(92) }}>
        {INSTRUCOES.map(([n, t]) => (
          <div key={n}>
            <b>{n}</b> {t}
          </div>
        ))}
      </div>

      <div className="folha-red-quadro" style={{ left: mm(112), top: mm(249), width: mm(74), height: mm(16) }}>
        <div className="folha-red-quadro-tit">USO DO PROFESSOR — competências (0 a 200)</div>
        <table>
          <thead>
            <tr>
              <th>C1</th>
              <th>C2</th>
              <th>C3</th>
              <th>C4</th>
              <th>C5</th>
              <th>NOTA</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td />
              <td />
              <td />
              <td />
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
