import { X, FileText, ExternalLink, Phone } from 'lucide-react';

interface MatriculaInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MatriculaInfoModal({ isOpen, onClose }: MatriculaInfoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white max-w-xl w-full rounded-2xl shadow-2xl relative my-auto">
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors z-50 border border-gray-200"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div className="bg-white rounded-t-2xl p-6 md:p-8 flex items-center gap-4 border-b border-gray-200">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-[#002f6c] shrink-0">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#002f6c]">Matrícula</h2>
            <p className="text-sm text-gray-500">Informações e formulários</p>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-5">
          <p className="text-gray-700 leading-relaxed">
            A matrícula na rede estadual de Mato Grosso do Sul é feita pelo sistema oficial da SED-MS,{' '}
            <strong>Matrícula Digital</strong> — este portal da escola é complementar e não substitui o
            sistema oficial.
          </p>

          <a
            href="https://www.matriculadigital.ms.gov.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-100 transition-colors"
          >
            <div>
              <p className="font-bold text-[#002f6c]">Acessar Matrícula Digital (SED-MS)</p>
              <p className="text-xs text-gray-500">www.matriculadigital.ms.gov.br</p>
            </div>
            <ExternalLink className="w-5 h-5 text-[#002f6c] shrink-0" />
          </a>

          <div>
            <p className="font-bold text-gray-800 mb-2">Documentos geralmente solicitados</p>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• RG ou Certidão de Nascimento do aluno</li>
              <li>• CPF do aluno (quando houver)</li>
              <li>• Comprovante de residência</li>
              <li>• Histórico escolar ou declaração da escola de origem</li>
            </ul>
            <p className="text-xs text-gray-400 mt-2">
              A lista pode variar por ano letivo — confirme sempre no portal oficial ou diretamente na secretaria da escola.
            </p>
          </div>

          <div className="flex items-start gap-3 pt-2 border-t border-gray-100">
            <Phone className="w-5 h-5 text-[#002f6c] mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-gray-800">Central de Matrícula (SED-MS)</p>
              <p className="text-gray-600 text-sm">0800-647-0028</p>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Dúvidas específicas sobre a matrícula nesta unidade? Fale com a secretaria da escola pelo telefone (67) 3387-9966.
          </p>
        </div>
      </div>
    </div>
  );
}
