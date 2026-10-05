import type { CampoConvocacao, ModoPreenchimento } from '../../services/cadastroServidorService';
import { campoEhData } from '../../utils/cadastroServidor';

interface Props {
  campos: CampoConvocacao[];
  modos: Record<string, ModoPreenchimento>; // modo de cada campo, congelado quando o cadastro foi criado
  valores: Record<string, string>;
  onChange: (campo: string, valor: string) => void;
  // Quem está olhando: o servidor só edita PROFESSOR/AMBOS; a Secretaria edita todos.
  quem: 'PROFESSOR' | 'SECRETARIA';
}

const classeInput = 'w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue disabled:opacity-60';
const ROTULO_MODO: Record<ModoPreenchimento, string> = { SECRETARIA: 'Secretaria', PROFESSOR: 'Servidor', AMBOS: 'Os dois' };

// Campos do termo de convocado dentro do cadastro. O servidor vê só o que pode preencher e, em
// leitura, o que a Secretaria já informou. O banco impõe a mesma regra (gatilho do cadastro).
export function ConvocacaoCampos({ campos, modos, valores, onChange, quem }: Props) {
  const visiveis = campos.filter((c) => {
    const modo = modos[c.campo] ?? 'SECRETARIA';
    return quem === 'SECRETARIA' || modo !== 'SECRETARIA' || Boolean(valores[c.campo]);
  });
  if (visiveis.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {visiveis.map((c) => {
        const modo = modos[c.campo] ?? 'SECRETARIA';
        const editavel = quem === 'SECRETARIA' || modo !== 'SECRETARIA';
        return (
          <label key={c.campo} className="block">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
              {c.rotulo}
              <span className="normal-case font-bold tracking-normal text-gray-500">
                {quem === 'SECRETARIA' ? `preenche: ${ROTULO_MODO[modo]}` : editavel ? '' : 'informado pela Secretaria'}
              </span>
            </span>
            <input
              type={campoEhData(c.campo) ? 'date' : 'text'}
              value={valores[c.campo] ?? ''}
              disabled={!editavel}
              onChange={(e) => onChange(c.campo, e.target.value)}
              placeholder={c.dica ?? ''}
              className={classeInput}
            />
          </label>
        );
      })}
    </div>
  );
}
