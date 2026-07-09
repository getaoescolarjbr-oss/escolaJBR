import { X, Construction } from 'lucide-react';

interface EmBreveModalProps {
  isOpen: boolean;
  onClose: () => void;
  titulo: string;
}

export function EmBreveModal({ isOpen, onClose, titulo }: EmBreveModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white max-w-sm w-full rounded-2xl shadow-2xl relative p-8 text-center">
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors border border-gray-200"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-[#002f6c] mx-auto mb-4">
          <Construction className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-[#002f6c] mb-2">{titulo}</h2>
        <p className="text-gray-600 text-sm">
          Este módulo ainda está em desenvolvimento e estará disponível em breve neste portal.
        </p>
      </div>
    </div>
  );
}
