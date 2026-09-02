import {
  BOLHA_MM,
  MARCA_MM,
  calcularGeometria,
  type CartaoGeom,
  type ItemCartao,
} from '../../../utils/cartaoResposta';

// O cartão-resposta de UM aluno. É o mesmo componente na tela e no papel: o preview
// existe justamente para o professor ver antes de gastar 30 folhas, então renderizar
// coisas diferentes nos dois lugares derrotaria o propósito.
//
// Todas as posições vêm de calcularGeometria() e são as MESMAS que lib/omr.ts usa para
// procurar as bolhas na foto.

// As marcas são desenhadas a partir do centro, então metade de cada uma fica para fora
// do retângulo de referência. Esta folga cerca a folha inteira.
const FOLGA_MM = MARCA_MM / 2;

interface DadosAluno {
  nome: string;
  numeroChamada: number | null;
  codigoSgde: string | null;
  turma: string | null;
  serie: string | null;
}

interface Props {
  aluno: DadosAluno;
  versao: string;
  /** Data URL do QR já gerado — a geração é assíncrona e acontece antes de renderizar. */
  qrDataUrl: string;
  titulo: string;
  disciplina: string | null;
  dataAplicacao: string;
  itens: ItemCartao[];
  /** Quando informado, evita recalcular a geometria a cada aluno da lista. */
  geom?: CartaoGeom;
}

export function CartaoRespostaFolha({
  aluno, versao, qrDataUrl, titulo, disciplina, dataAplicacao, itens, geom: geomExterna,
}: Props) {
  const geom = geomExterna ?? calcularGeometria(itens);

  const mm = (v: number) => `${v}mm`;
  // Papel -> CSS: desloca tudo pela folga das marcas.
  const pos = (x: number, y: number) => ({ left: mm(x + FOLGA_MM), top: mm(y + FOLGA_MM) });

  return (
    <div className="cartao-omr-folha">
      <div className="cartao-omr-cabecalho">
        <img src={qrDataUrl} alt="" className="cartao-omr-qr" />
        <div className="cartao-omr-dados">
          <div className="nome">{aluno.nome}</div>
          <div className="linha-dados">
            {aluno.serie ? `${aluno.serie} — ` : ''}Turma {aluno.turma ?? '—'}
            {aluno.numeroChamada != null ? ` · Nº ${aluno.numeroChamada}` : ''}
            {aluno.codigoSgde ? ` · SGDE ${aluno.codigoSgde}` : ''}
          </div>
          <div className="linha-dados">
            <strong>{titulo}</strong>
            {disciplina ? ` — ${disciplina}` : ''} · {dataAplicacao}
          </div>
        </div>
        <div className="cartao-omr-versao">
          <div className="cap">Versão</div>
          <div className="rot">{versao}</div>
        </div>
      </div>

      <div className="cartao-omr-aviso">
        <strong>Como preencher:</strong> pinte o círculo <em>inteiro</em>, com caneta azul ou preta.
        Não use corretivo, não rasure e não dobre a folha. Duas marcas na mesma questão anulam a
        resposta. Não escreva sobre os quadrados pretos dos cantos.
      </div>

      <div
        className="cartao-omr"
        style={{ width: mm(geom.larguraMm + MARCA_MM), height: mm(geom.alturaMm + MARCA_MM) }}
      >
        {geom.marcas.map((marca, i) => (
          <div
            key={`m${i}`}
            className="cartao-omr-marca"
            style={{ ...pos(marca.x, marca.y), width: mm(MARCA_MM), height: mm(MARCA_MM) }}
          />
        ))}

        {geom.linhas.map((linha) => (
          <div key={linha.linha}>
            <div
              className="cartao-omr-rotulo"
              style={{
                left: mm(linha.rotuloX + FOLGA_MM),
                top: mm(linha.rotuloY + FOLGA_MM),
                fontSize: mm(3.2),
              }}
            >
              {linha.numeroNaProva}
            </div>
            {linha.bolhas.map((bolha) => (
              <div
                key={`${linha.linha}-${bolha.letra}`}
                className="cartao-omr-bolha"
                style={{
                  ...pos(bolha.x, bolha.y),
                  width: mm(BOLHA_MM),
                  height: mm(BOLHA_MM),
                  fontSize: mm(2.4),
                }}
              >
                {/* A letra sai em cinza claro: o aluno precisa dela para saber onde
                    pintar, mas ela entra em TODA bolha por igual, então não desequilibra
                    a comparação relativa que decide qual foi marcada. */}
                <span style={{ color: '#aaa' }}>{bolha.letra}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
