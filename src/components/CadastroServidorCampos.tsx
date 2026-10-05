import {
  type CamposServidor,
  AREAS_CONHECIMENTO_CADASTRO,
  CARGOS_SERVIDOR,
  STATUS_SERVIDOR_CADASTRO,
  formatarCpf,
  formatarTelefone,
} from '../utils/cadastroServidor';

interface Props {
  valores: CamposServidor;
  onChange: (valores: CamposServidor) => void;
  // 'edicao': corrigir dados de um cadastro já criado (sem aviso inicial nem aceite LGPD).
  modo?: 'cadastro' | 'edicao';
}

const classeInput =
  'w-full px-4 py-3 bg-[#F0F2F5] border border-[#003366]/30 text-[#003366] rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-[#003366] outline-none transition-all placeholder:text-gray-400 font-medium';
const classeLabel = 'block text-xs font-bold text-[#003366] uppercase tracking-widest mb-2';

// Dados do servidor no primeiro acesso. Aparecem só quando o e-mail ainda não está na
// base da escola: esse cadastro fica aguardando aprovação da Secretaria/Gestão.
export function CadastroServidorCampos({ valores, onChange, modo = 'cadastro' }: Props) {
  const set = <K extends keyof CamposServidor>(campo: K, valor: CamposServidor[K]) =>
    onChange({ ...valores, [campo]: valor });

  return (
    <div className="space-y-6">
      {modo === 'cadastro' && (
        <p className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-lg p-3">
          Seu e-mail ainda não está na base da escola. Preencha seus dados. Na próxima etapa você envia os
          documentos e, depois que a Secretaria ou a Gestão aprovar o cadastro, o acesso é liberado.
        </p>
      )}

      <div>
        <label className={classeLabel}>Nome completo</label>
        <input
          required
          minLength={5}
          value={valores.nome}
          onChange={(e) => set('nome', e.target.value)}
          className={classeInput}
        />
      </div>

      <div>
        <label className={classeLabel}>Função / Cargo</label>
        <select required value={valores.cargo} onChange={(e) => set('cargo', e.target.value)} className={classeInput}>
          {CARGOS_SERVIDOR.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={classeLabel}>CPF</label>
          <input
            required
            inputMode="numeric"
            value={valores.cpf}
            onChange={(e) => set('cpf', formatarCpf(e.target.value))}
            placeholder="000.000.000-00"
            className={classeInput}
          />
        </div>
        <div>
          <label className={classeLabel}>Data de nascimento</label>
          <input
            required
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={valores.dataNascimento}
            onChange={(e) => set('dataNascimento', e.target.value)}
            className={classeInput}
          />
        </div>
      </div>

      <div>
        <label className={classeLabel}>Telefone / WhatsApp</label>
        <input
          required
          inputMode="tel"
          value={valores.telefone}
          onChange={(e) => set('telefone', formatarTelefone(e.target.value))}
          placeholder="(00) 00000-0000"
          className={classeInput}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={classeLabel}>Área de conhecimento</label>
          <select value={valores.areaConhecimento} onChange={(e) => set('areaConhecimento', e.target.value)} className={classeInput}>
            <option value="">Não se aplica</option>
            {AREAS_CONHECIMENTO_CADASTRO.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={classeLabel}>Vínculo</label>
          <select required value={valores.statusServidor} onChange={(e) => set('statusServidor', e.target.value)} className={classeInput}>
            {STATUS_SERVIDOR_CADASTRO.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={classeLabel}>RG</label>
          <input required value={valores.rg} onChange={(e) => set('rg', e.target.value)} placeholder="Número e órgão emissor" className={classeInput} />
        </div>
        <div>
          <label className={classeLabel}>Telefone fixo (opcional)</label>
          <input inputMode="tel" value={valores.telefoneFixo} onChange={(e) => set('telefoneFixo', formatarTelefone(e.target.value))} placeholder="(00) 0000-0000" className={classeInput} />
        </div>
      </div>

      <div>
        <label className={classeLabel}>Endereço residencial</label>
        <input required value={valores.endereco} onChange={(e) => set('endereco', e.target.value)} placeholder="Rua, número, bairro, cidade" className={classeInput} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={classeLabel}>Título de eleitor</label>
          <input value={valores.tituloEleitor} onChange={(e) => set('tituloEleitor', e.target.value)} className={classeInput} />
        </div>
        <div>
          <label className={classeLabel}>Zona</label>
          <input value={valores.zonaEleitoral} onChange={(e) => set('zonaEleitoral', e.target.value)} className={classeInput} />
        </div>
        <div>
          <label className={classeLabel}>Seção</label>
          <input value={valores.secaoEleitoral} onChange={(e) => set('secaoEleitoral', e.target.value)} className={classeInput} />
        </div>
      </div>

      <div>
        <label className={classeLabel}>Formação / graduação / especialização</label>
        <input value={valores.formacao} onChange={(e) => set('formacao', e.target.value)} placeholder="Ex.: Licenciatura em Matemática; Especialização em Educação Especial" className={classeInput} />
      </div>

      {modo === 'cadastro' && (
      <label className="flex items-start gap-3 text-xs text-gray-700 leading-relaxed cursor-pointer">
        <input
          type="checkbox"
          required
          checked={valores.aceiteLgpd}
          onChange={(e) => set('aceiteLgpd', e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#003366]"
        />
        <span>
          Autorizo a escola a tratar meus dados pessoais (nome, CPF, nascimento e telefone) para fins de gestão
          funcional, conforme a LGPD.
        </span>
      </label>
      )}
    </div>
  );
}
