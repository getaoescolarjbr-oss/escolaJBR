import { useEffect, useState } from 'react';
import { X, UtensilsCrossed, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CardapioPublicoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ItemExibicao {
  nome: string;
  descricao_preparacao: string | null;
}

interface CardapioExibicao {
  id: string;
  data: string;
  turno: string;
  itens: ItemExibicao[];
}

export function CardapioPublicoModal({ isOpen, onClose }: CardapioPublicoModalProps) {
  const [cardapios, setCardapios] = useState<CardapioExibicao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    async function carregar() {
      setLoading(true);
      const hoje = new Date().toISOString().slice(0, 10);
      const daqui14dias = new Date();
      daqui14dias.setDate(daqui14dias.getDate() + 14);
      const fim = daqui14dias.toISOString().slice(0, 10);

      const { data: listaCardapios } = await supabase
        .from('cardapios')
        .select('id, data, turno')
        .eq('publicado', true)
        .gte('data', hoje)
        .lte('data', fim)
        .order('data');

      if (!listaCardapios || listaCardapios.length === 0) {
        setCardapios([]);
        setLoading(false);
        return;
      }

      const { data: itensCardapio } = await supabase
        .from('cardapio_itens')
        .select('cardapio_id, descricao_preparacao, estoque_itens(nome)')
        .in('cardapio_id', listaCardapios.map((c) => c.id));

      const mapeados = listaCardapios.map((c) => ({
        ...c,
        itens: (itensCardapio ?? [])
          .filter((i) => i.cardapio_id === c.id)
          .map((i) => ({
            nome: (i as unknown as { estoque_itens: { nome: string } | null }).estoque_itens?.nome ?? '',
            descricao_preparacao: i.descricao_preparacao,
          })),
      }));

      setCardapios(mapeados);
      setLoading(false);
    }

    carregar().catch(console.error);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl relative my-auto">
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors z-50 border border-gray-200"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div className="bg-white rounded-t-2xl p-6 md:p-8 flex items-center gap-4 border-b border-gray-200">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-[#002f6c] shrink-0">
            <UtensilsCrossed className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#002f6c]">Cardápio Escolar</h2>
            <p className="text-sm text-gray-500">Merenda dos próximos dias</p>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#002f6c]" /></div>
          ) : cardapios.length === 0 ? (
            <p className="text-center text-gray-500 py-10">Nenhum cardápio publicado no momento. Volte em breve.</p>
          ) : (
            cardapios.map((c) => (
              <div key={c.id} className="border border-gray-200 rounded-xl p-4">
                <p className="font-black text-[#002f6c] uppercase text-sm tracking-wide">
                  {new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} — {c.turno}
                </p>
                {c.itens.length === 0 ? (
                  <p className="text-sm text-gray-400 mt-2">Cardápio ainda não detalhado.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {c.itens.map((item, idx) => (
                      <li key={idx} className="text-sm text-gray-700">
                        • {item.descricao_preparacao || item.nome}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
