import { X, Phone, Mail, MapPin, Clock } from 'lucide-react';

interface ContatoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContatoModal({ isOpen, onClose }: ContatoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl relative my-auto">
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors z-50 border border-gray-200"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div className="bg-white rounded-t-2xl p-6 md:p-8 flex items-center gap-4 border-b border-gray-200">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-[#002f6c] shrink-0">
            <Phone className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#002f6c]">Fale com a Escola</h2>
            <p className="text-sm text-gray-500">Canais de atendimento</p>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-5">
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-[#002f6c] mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-gray-800">Telefone</p>
              <a href="tel:+556733879966" className="text-gray-600 hover:text-[#002f6c]">(67) 3387-9966</a>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-[#002f6c] mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-gray-800">E-mail institucional</p>
              <a href="mailto:eejbr@sed.ms.gov.br" className="text-gray-600 hover:text-[#002f6c]">eejbr@sed.ms.gov.br</a>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-[#002f6c] mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-gray-800">Endereço</p>
              <p className="text-gray-600">Rua Elesbão Murtinho, 856 — Bairro Universitário<br />Campo Grande/MS</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-[#002f6c] mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-gray-800">Atendimento presencial</p>
              <p className="text-gray-600">Segunda a sexta, em horário de funcionamento da escola.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Para assuntos de matrícula junto à rede estadual, veja também a Central de Matrícula da SED-MS em "Matrícula" no menu de Acesso Rápido.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
