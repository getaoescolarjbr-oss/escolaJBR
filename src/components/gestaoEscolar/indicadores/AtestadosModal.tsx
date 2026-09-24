import { ModalShell } from './ModalShell';
import { AtestadosEstatisticas } from './AtestadosEstatisticas';
import { AusenciasTab } from '../rh/AusenciasTab';

// Estatísticas no topo + a tela de Ausências/Atestados do RH (listar, cadastrar, anexar
// documento, encerrar) — mesma regra de acesso e mesma tabela, sem duplicar o cadastro.
export function AtestadosModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell titulo="Servidores com atestado" onClose={onClose} largura="max-w-5xl">
      <div className="space-y-6">
        <AtestadosEstatisticas />
        <AusenciasTab />
      </div>
    </ModalShell>
  );
}
