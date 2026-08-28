import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { DivergenciaMatricula } from '../../types/secretaria';
import { listarDivergencias } from '../../services/secretariaService';

export function DivergenciasTab() {
  const [divergencias, setDivergencias] = useState<DivergenciaMatricula[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listarDivergencias()
      .then(setDivergencias)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs text-gray-500">
        Compara o status da ficha de matrícula (Secretaria) com o status operacional do aluno (Painel Admin &gt;
        Alunos) no ano letivo corrente. Divergências aqui não são corrigidas automaticamente — servem de alerta para
        alinhar manualmente os dois lados.
      </p>

      {loading ? (
        <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
      ) : divergencias.length === 0 ? (
        <p className="text-sm text-green-500">Nenhuma divergência encontrada.</p>
      ) : (
        <div className="space-y-2">
          {divergencias.map((d) => (
            <div key={d.aluno_id} className="flex items-center gap-3 px-4 py-3 bg-yellow-950/10 border border-yellow-700/40 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-ms-main">{d.pessoa_nome}</p>
                <p className="text-xs text-gray-400">
                  Matrícula ({d.ano_letivo}): <span className="font-bold">{d.status_matricula}</span> · Operacional: <span className="font-bold">{d.status_operacional}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
