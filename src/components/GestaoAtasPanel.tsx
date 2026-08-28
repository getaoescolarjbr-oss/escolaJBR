import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Printer, Eye, Search, Filter, Loader2, Calendar, FileBadge, Settings, RefreshCw, CheckCircle, Clock, Ban, Trash2, Hash } from 'lucide-react';
import { AtaTemplateManager } from './admin/AtaTemplateManager';
import { AtaModal } from './AtaModal';

export function GestaoAtasPanel() {
  const [atas, setAtas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBimestre, setSelectedBimestre] = useState<number | 'todos'>('todos');
  const [activeTab, setActiveTab] = useState<'lista' | 'templates'>('lista');
  const [numeroInicial, setNumeroInicial] = useState<string>('');
  const [savingNumero, setSavingNumero] = useState(false);
  const [anulando, setAnulando] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  // Estados para visualização/edição individual de ata
  const [selectedAta, setSelectedAta] = useState<any | null>(null);
  const [selectedAtaStudent, setSelectedAtaStudent] = useState<any | null>(null);

  useEffect(() => {
    fetchAtas();
    fetchNumeroInicial();
  }, []);

  async function fetchNumeroInicial() {
    try {
      const { data } = await supabase
        .from('configuracoes_escola')
        .select('valor')
        .eq('chave', 'ata_numero_inicial')
        .maybeSingle();
      if (data?.valor) setNumeroInicial(data.valor);
    } catch {
      // Tabela pode não existir ainda, ignora silenciosamente
    }
  }

  async function handleSaveNumeroInicial() {
    if (!numeroInicial || isNaN(Number(numeroInicial)) || Number(numeroInicial) < 1) {
      alert('Digite um número válido (maior que 0).');
      return;
    }
    setSavingNumero(true);
    try {
      const { error } = await supabase
        .from('configuracoes_escola')
        .upsert({ chave: 'ata_numero_inicial', valor: String(numeroInicial) }, { onConflict: 'chave' });
      if (error) throw error;
      alert(`Número inicial definido como ${numeroInicial}. As próximas atas usarão numeração a partir deste valor.`);
    } catch (err: any) {
      alert('Erro ao salvar configuração: ' + err.message);
    } finally {
      setSavingNumero(false);
    }
  }

  async function fetchAtas() {
    setLoading(true);
    try {
      // 1. Buscar todas as atas
      const { data: atasData, error: atasError } = await supabase
        .from('atas_alunos')
        .select('*')
        .order('numero_sequencial', { ascending: false });

      if (atasError) throw atasError;
      if (!atasData || atasData.length === 0) { setAtas([]); return; }

      // 2. Coletar IDs únicos de alunos
      const alunoIds = [...new Set(atasData.map((a: any) => a.aluno_id).filter(Boolean))];

      // 3. Buscar dados dos alunos
      const { data: alunosData } = await supabase
        .from('alunos')
        .select('id, nome, turma_id, turmas(nome)')
        .in('id', alunoIds);

      // 4. Montar mapa de alunos
      const alunoMap: Record<string, any> = {};
      (alunosData || []).forEach((al: any) => {
        alunoMap[al.id] = { id: al.id, nome: al.nome, turmas: al.turmas || null };
      });

      // 5. Join em memória
      const atasComAlunos = atasData.map((ata: any) => ({
        ...ata,
        alunos: alunoMap[ata.aluno_id] || null,
      }));

      setAtas(atasComAlunos);
    } catch (error) {
      console.error('Erro ao buscar atas:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnularAta(ataId: string, isAnulada: boolean) {
    const confirmMsg = isAnulada
      ? 'Deseja REATIVAR esta ata? O status "Anulada" será removido.'
      : 'Tem certeza que deseja ANULAR esta ata? Ela ficará registrada como anulada (título riscado).';
    if (!window.confirm(confirmMsg)) return;
    setAnulando(ataId);
    try {
      const { error } = await supabase
        .from('atas_alunos')
        .update({ anulada: !isAnulada })
        .eq('id', ataId);
      if (error) throw error;
      setAtas(prev => prev.map(a => a.id === ataId ? { ...a, anulada: !isAnulada } : a));
    } catch (err: any) {
      alert('Erro ao anular ata: ' + err.message);
    } finally {
      setAnulando(null);
    }
  }

  async function handleExcluirAta(ataId: string, ataNumero: string, ataTitulo: string) {
    if (!window.confirm(`Tem certeza que deseja EXCLUIR PERMANENTEMENTE a Ata Nº ${ataNumero} — "${ataTitulo}"?\n\nEsta ação é irreversível.`)) return;
    setExcluindo(ataId);
    try {
      const { error } = await supabase
        .from('atas_alunos')
        .delete()
        .eq('id', ataId);
      if (error) throw error;
      setAtas(prev => prev.filter(a => a.id !== ataId));
    } catch (err: any) {
      alert('Erro ao excluir ata: ' + err.message);
    } finally {
      setExcluindo(null);
    }
  }

  // Filtrar as atas de acordo com busca e bimestre
  const filteredAtas = atas.filter(ata => {
    const nomeAluno = ata.alunos?.nome?.toLowerCase() || '';
    const numAta = String(ata.numero_sequencial || '').padStart(3, '0');
    const matchesSearch = nomeAluno.includes(searchTerm.toLowerCase()) || numAta.includes(searchTerm);
    const matchesBimestre = selectedBimestre === 'todos' || ata.bimestre_id === Number(selectedBimestre);
    return matchesSearch && matchesBimestre;
  });

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const reportRows = filteredAtas.map(ata => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px; ${ata.anulada ? 'opacity: 0.4;' : ''}">
        <td style="padding: 12px; font-weight: bold; color: #1e293b; ${ata.anulada ? 'text-decoration: line-through;' : ''}">${String(ata.numero_sequencial || '').padStart(3, '0')}</td>
        <td style="padding: 12px; color: #334155;">${ata.data_ata ? new Date(ata.data_ata + 'T12:00:00').toLocaleDateString('pt-BR') : new Date(ata.created_at).toLocaleDateString()}</td>
        <td style="padding: 12px; font-weight: bold; color: #0f172a;">${ata.alunos?.nome || 'Não identificado'}</td>
        <td style="padding: 12px; color: #475569;">${ata.alunos?.turmas?.nome || 'N/A'}</td>
        <td style="padding: 12px; color: #475569; ${ata.anulada ? 'text-decoration: line-through;' : ''}">${ata.titulo}</td>
        <td style="padding: 12px; font-weight: bold; color: ${ata.anulada ? '#ef4444' : ata.imagem_assinatura_url ? '#10b981' : '#f59e0b'};">
          ${ata.anulada ? 'ANULADA' : ata.imagem_assinatura_url ? 'Assinada' : 'Pendente'}
        </td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório de Atas de Reunião</title>
          <style>
            body { font-family: 'Inter', sans-serif; margin: 40px; color: #0f172a; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }
            .header img { height: 60px; margin-bottom: 10px; }
            .header h1 { font-size: 20px; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
            .header p { font-size: 11px; color: #64748b; margin: 5px 0 0 0; font-weight: bold; text-transform: uppercase; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; font-weight: bold; color: #475569; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; padding: 12px; font-size: 11px; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; }
            .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="/logo.png.png" alt="Logo Escola" />
            <h1>E.E. José Barbosa Rodrigues</h1>
            <p>Relatório de Atas de Reunião Consolidado</p>
          </div>
          <div class="meta">
            <span>Filtro Bimestre: ${selectedBimestre === 'todos' ? 'Todos' : selectedBimestre + 'º Bimestre'}</span>
            <span>Total de Registros: ${filteredAtas.length}</span>
            <span>Emissão: ${new Date().toLocaleDateString('pt-BR')}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 8%">Nº Ata</th>
                <th style="width: 12%">Data</th>
                <th style="width: 30%">Aluno</th>
                <th style="width: 15%">Turma</th>
                <th style="width: 23%">Título da Reunião</th>
                <th style="width: 12%">Status</th>
              </tr>
            </thead>
            <tbody>
              ${reportRows || '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8;">Nenhuma ata encontrada com os filtros selecionados.</td></tr>'}
            </tbody>
          </table>
          <div class="footer">
            Portal de Gestão Escolar • Escola Estadual José Barbosa Rodrigues
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      
      {/* NAVEGAÇÃO DE ABAS */}
      <div className="flex justify-between items-center bg-ms-card px-6 py-4 rounded-3xl border border-ms-border shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-2xl border border-blue-500/20">
            <FileBadge className="w-5 h-5 text-ms-blueText" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">Gestão Central de Atas</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Painel Administrativo da Coordenação</p>
          </div>
        </div>

        <div className="flex bg-ms-dark/60 p-1.5 rounded-2xl border border-ms-border">
          <button
            onClick={() => setActiveTab('lista')}
            className={`flex items-center gap-2 px-5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === 'lista'
                ? 'bg-ms-blue text-white shadow-lg shadow-ms-blue/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" /> Atas Emitidas
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === 'templates'
                ? 'bg-ms-blue text-white shadow-lg shadow-ms-blue/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" /> Modelos de Atas
          </button>
        </div>
      </div>

      {/* PAINEL DE NUMERAÇÃO INICIAL DE ATAS */}
      {activeTab === 'lista' && (
        <div className="bg-ms-card rounded-3xl border border-ms-border px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-2xl border border-amber-500/20">
              <Hash className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Numeração de Atas</h3>
              <p className="text-xs text-gray-500 font-bold">Defina o número inicial para geração sequencial das atas</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:ml-auto">
            <input
              type="number"
              min="1"
              value={numeroInicial}
              onChange={e => setNumeroInicial(e.target.value)}
              placeholder="Ex: 101"
              className="w-32 bg-ms-dark/60 border border-ms-border rounded-xl px-4 py-2.5 text-sm font-black text-white outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-all placeholder-gray-600 text-center"
            />
            <button
              onClick={handleSaveNumeroInicial}
              disabled={savingNumero || !numeroInicial}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              {savingNumero ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Definir Número Inicial
            </button>
          </div>
        </div>
      )}

      {activeTab === 'lista' ? (
        <div className="bg-ms-card rounded-3xl border border-ms-border shadow-xl overflow-hidden">
          
          {/* BARRA DE FILTROS & AÇÕES */}
          <div className="p-6 border-b border-ms-border bg-ms-dark/10 flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Campo de Busca */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar por nome do aluno ou Nº de ata..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-ms-dark/60 border border-ms-border rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-white outline-none focus:border-ms-blueText focus:ring-2 focus:ring-ms-blue/10 transition-all placeholder-gray-500"
              />
            </div>

            {/* Dropdown de Bimestre e Botões de Ação */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              <div className="flex items-center gap-2 bg-ms-dark/60 border border-ms-border rounded-2xl px-3 py-1.5">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select
                  value={selectedBimestre}
                  onChange={(e) => setSelectedBimestre(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
                  className="bg-transparent border-none text-xs font-black text-white outline-none pr-6 cursor-pointer"
                >
                  <option value="todos" className="bg-ms-card text-white">Todos os Bimestres</option>
                  <option value="1" className="bg-ms-card text-white">1º Bimestre</option>
                  <option value="2" className="bg-ms-card text-white">2º Bimestre</option>
                  <option value="3" className="bg-ms-card text-white">3º Bimestre</option>
                  <option value="4" className="bg-ms-card text-white">4º Bimestre</option>
                </select>
              </div>

              <button
                onClick={fetchAtas}
                className="p-3 bg-ms-dark/60 border border-ms-border hover:bg-white/5 rounded-2xl transition-all text-gray-400 hover:text-white"
                title="Recarregar Atas"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={handlePrintReport}
                disabled={filteredAtas.length === 0}
                className="flex items-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-green-600/10"
              >
                <Printer className="w-4 h-4" /> Imprimir Relatório
              </button>
            </div>

          </div>

          {/* TABELA DE ATAS */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-ms-blueText mb-4" />
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando lista de atas...</p>
              </div>
            ) : filteredAtas.length === 0 ? (
              <div className="py-24 text-center">
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Nenhuma ata registrada ou encontrada.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-ms-border text-[10px] font-black uppercase tracking-widest text-gray-500 bg-ms-dark/5">
                    <th className="px-6 py-4 w-20">Nº Ata</th>
                    <th className="px-6 py-4 w-32">Data</th>
                    <th className="px-6 py-4">Estudante</th>
                    <th className="px-6 py-4 w-28">Turma</th>
                    <th className="px-6 py-4">Assunto / Título</th>
                    <th className="px-6 py-4 w-32">Status</th>
                    <th className="px-6 py-4 w-44 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ms-border/30">
                  {filteredAtas.map((ata) => {
                    const numeroFormatado = String(ata.numero_sequencial || '').padStart(3, '0');
                    const dataFormatada = ata.data_ata 
                      ? new Date(ata.data_ata + 'T12:00:00').toLocaleDateString('pt-BR')
                      : new Date(ata.created_at).toLocaleDateString();
                    const isAnulada = !!ata.anulada;

                    return (
                      <tr key={ata.id} className={`transition-colors ${isAnulada ? 'opacity-40' : 'hover:bg-white/[0.02]'}`}>
                        <td className="px-6 py-4 font-black text-white">
                          <span className={isAnulada ? 'line-through text-red-400' : ''}>{numeroFormatado}</span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400 font-bold">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-500" />
                            {dataFormatada}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-white text-sm">{ata.alunos?.nome || 'Sem identificação'}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-ms-dark/65 border border-ms-border text-gray-300 font-black rounded-lg text-[10px] uppercase">
                            {ata.alunos?.turmas?.nome || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300 font-bold truncate max-w-[200px]" title={ata.titulo}>
                          <span className={isAnulada ? 'line-through' : ''}>{ata.titulo}</span>
                        </td>
                        <td className="px-6 py-4">
                          {isAnulada ? (
                            <span className="flex items-center gap-1.5 text-red-400 text-xs font-black uppercase">
                              <Ban className="w-4 h-4" /> Anulada
                            </span>
                          ) : ata.imagem_assinatura_url ? (
                            <span className="flex items-center gap-1.5 text-green-400 text-xs font-black uppercase">
                              <CheckCircle className="w-4 h-4" /> Assinada
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-amber-500 text-xs font-black uppercase">
                              <Clock className="w-4 h-4" /> Pendente
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {/* Visualizar — oculto se anulada */}
                            {!isAnulada && (
                              <button
                                onClick={() => {
                                  setSelectedAta(ata);
                                  setSelectedAtaStudent(ata.alunos);
                                }}
                                className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-ms-blueText hover:bg-ms-blue hover:text-white rounded-xl transition-all"
                                title="Visualizar e Gerenciar"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            {/* Anular / Reativar */}
                            <button
                              onClick={() => handleAnularAta(ata.id, isAnulada)}
                              disabled={anulando === ata.id}
                              className={`p-2.5 border rounded-xl transition-all ${
                                isAnulada
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                                  : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white'
                              }`}
                              title={isAnulada ? 'Reativar Ata' : 'Anular Ata'}
                            >
                              {anulando === ata.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Ban className="w-4 h-4" />
                              }
                            </button>
                            {/* Excluir */}
                            <button
                              onClick={() => handleExcluirAta(ata.id, numeroFormatado, ata.titulo)}
                              disabled={excluindo === ata.id}
                              className="p-2.5 bg-gray-500/10 border border-gray-500/20 text-gray-400 hover:bg-red-600 hover:text-white hover:border-red-600 rounded-xl transition-all"
                              title="Excluir Ata Permanentemente"
                            >
                              {excluindo === ata.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Trash2 className="w-4 h-4" />
                              }
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

        </div>
      ) : (
        <AtaTemplateManager />
      )}

      {/* MODAL DE ATA EMITIDA */}
      {selectedAta && selectedAtaStudent && (
        <AtaModal
          aluno={{ id: selectedAtaStudent.id, aluno_id: selectedAtaStudent.id, nome: selectedAtaStudent.nome } as any}
          template={{ id: selectedAta.template_id, titulo: selectedAta.titulo, conteudo: '' }}
          ataExistente={selectedAta}
          onClose={() => {
            setSelectedAta(null);
            setSelectedAtaStudent(null);
          }}
          onUploadSuccess={() => {
            fetchAtas();
          }}
        />
      )}

    </div>
  );
}
