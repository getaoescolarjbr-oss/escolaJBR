import { Crown, Scale, AlertTriangle } from 'lucide-react';
import { SectionIcon } from '../../ui/SectionIcon';
import type { MembroColegiado, SegmentoMembro } from '../../../types/governanca';

// Composição oficial do Colegiado Escolar (rede estadual de MS): paritária, 50%
// profissionais da educação básica (professores/coordenadores/servidores
// administrativos) e 50% estudantes e pais/responsáveis (incluindo Grêmio e APM),
// mais membros natos (Diretor/Diretor-Adjunto) fora da paridade. A paridade é
// contada só por TITULARES — suplentes não compõem o corpo votante do órgão.
const SEGMENTOS_GRUPO_PROFISSIONAIS: SegmentoMembro[] = ['DOCENTE', 'ESPECIALISTA', 'FUNCIONARIO'];
const SEGMENTOS_GRUPO_COMUNIDADE: SegmentoMembro[] = ['ALUNO', 'PAIS'];

interface Props {
  membros: MembroColegiado[];
  nomePessoa: (pessoaId: string) => string | undefined;
}

export function ComposicaoColegiadoEscolar({ membros, nomePessoa }: Props) {
  const natos = membros.filter((m) => m.membro_nato);
  const titulares = membros.filter((m) => !m.membro_nato && m.titular_ou_suplente === 'TITULAR');
  const grupoProfissionais = titulares.filter((m) => SEGMENTOS_GRUPO_PROFISSIONAIS.includes(m.segmento));
  const grupoComunidade = titulares.filter((m) => SEGMENTOS_GRUPO_COMUNIDADE.includes(m.segmento));

  const total = grupoProfissionais.length + grupoComunidade.length;
  const pctProfissionais = total > 0 ? Math.round((grupoProfissionais.length / total) * 100) : 0;
  const pctComunidade = total > 0 ? 100 - pctProfissionais : 0;
  const paritario = total > 0 && grupoProfissionais.length === grupoComunidade.length;

  return (
    <div className="space-y-4">
      {natos.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-2">
            <SectionIcon icon={Crown} cor="purple" /> Membros natos (secretários executivos, sem voto na presidência)
          </p>
          {natos.map((m) => (
            <div key={m.id} className="px-3 py-2 rounded-lg border border-purple-500/20 bg-purple-500/5 text-sm text-gray-300">
              {nomePessoa(m.pessoa_id) ?? 'Pessoa'}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-2">
          <SectionIcon icon={Scale} cor="blue" /> Paridade (só titulares votantes)
        </p>
        {total === 0 ? (
          <p className="text-sm text-gray-500">Nenhum titular cadastrado ainda.</p>
        ) : (
          <>
            <div className="flex h-3 rounded-full overflow-hidden border border-gray-800">
              <div className="bg-ms-blue" style={{ width: `${pctProfissionais}%` }} />
              <div className="bg-emerald-500" style={{ width: `${pctComunidade}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ms-blue font-bold">Profissionais da educação: {grupoProfissionais.length} ({pctProfissionais}%)</span>
              <span className="text-emerald-400 font-bold">Estudantes/Pais: {grupoComunidade.length} ({pctComunidade}%)</span>
            </div>
            {!paritario && (
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-500">
                <AlertTriangle className="w-3.5 h-3.5" /> Fora da paridade 50/50 exigida pela norma estadual (Resolução SED nº 4.228/2023).
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
