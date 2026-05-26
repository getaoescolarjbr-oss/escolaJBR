import React, { useState, useRef, useEffect } from 'react';
import { X, Printer, Upload, CheckCircle, FileText, Sparkles, Loader2, ArrowRight, Eye, Edit3, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Aluno } from '../types';

interface AtaModalProps {
  aluno: Aluno;
  template: { id: string; titulo: string; conteudo: string };
  ataExistente?: {
    id: string;
    titulo: string;
    conteudo_gerado: string;
    imagem_assinatura_url: string | null;
    numero_sequencial?: number | null;
    data_ata?: string | null;
    acordado?: string | null;
    bimestre_id?: number | null;
  } | null;
  onClose: () => void;
  onUploadSuccess: () => void;
  bimestreAtual?: number;
}

export function AtaModal({ aluno, template, ataExistente, onClose, onUploadSuccess, bimestreAtual = 1 }: AtaModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados principais
  const [dataAta, setDataAta] = useState(new Date().toISOString().split('T')[0]);
  const [acordado, setAcordado] = useState('');
  const [conteudoGerado, setConteudoGerado] = useState('');
  const [numeroSequencial, setNumeroSequencial] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [mode, setMode] = useState<'fill' | 'preview'>('fill');

  // Inicialização e preenchimento se for ata existente
  useEffect(() => {
    if (ataExistente) {
      setDataAta(ataExistente.data_ata ? ataExistente.data_ata.split('T')[0] : new Date().toISOString().split('T')[0]);
      setAcordado(ataExistente.acordado || '');
      setConteudoGerado(ataExistente.conteudo_gerado || '');
      setNumeroSequencial(ataExistente.numero_sequencial || null);
      setMode('preview'); // Por padrão, visualizar se já existe
    } else {
      // Obter próximo número sequencial sugerido do banco
      const fetchProximoNumero = async () => {
        try {
          const { data, error } = await supabase
            .from('atas_alunos')
            .select('numero_sequencial')
            .order('numero_sequencial', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (!error) {
            setNumeroSequencial((data?.numero_sequencial || 0) + 1);
          } else {
            setNumeroSequencial(1);
          }
        } catch (e) {
          setNumeroSequencial(1);
        }
      };
      fetchProximoNumero();
    }
  }, [ataExistente]);

  // Formatar data em português por extenso
  const formatarDataExtenso = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T12:00:00'); // Evita deslocamento de fuso
    return date.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const numeroSequencialFormatado = numeroSequencial 
    ? String(numeroSequencial).padStart(3, '0') 
    : '---';

  const dataExtensa = formatarDataExtenso(dataAta);

  // Efeito para atualizar conteúdo gerado em tempo real na criação
  useEffect(() => {
    if (!ataExistente) {
      let texto = template.conteudo
        // Substituir Nome do Aluno
        .replace(/\{\{NOME_ALUNO\}\}/g, aluno.nome)
        .replace(/\[NOME_ALUNO\]/g, aluno.nome)
        .replace(/\{\{NOME\}\}/g, aluno.nome)
        .replace(/\[NOME\]/g, aluno.nome)
        .replace(/\{\{ALUNO\}\}/g, aluno.nome)
        .replace(/\[ALUNO\]/g, aluno.nome)
        // Substituir Data
        .replace(/\{\{DATA_ATA\}\}/g, dataExtensa)
        .replace(/\[DATA_ATA\]/g, dataExtensa)
        .replace(/\{\{DATA\}\}/g, dataExtensa)
        .replace(/\[DATA\]/g, dataExtensa)
        // Substituir Número
        .replace(/\{\{NUMERO_ATA\}\}/g, numeroSequencialFormatado)
        .replace(/\[NUMERO_ATA\]/g, numeroSequencialFormatado)
        .replace(/\{\{NUMERO\}\}/g, numeroSequencialFormatado)
        .replace(/\[NUMERO\]/g, numeroSequencialFormatado)
        .replace(/\{\{NUMERO_ATA_SEQUENCIAL\}\}/g, numeroSequencialFormatado)
        .replace(/\[NUMERO_ATA_SEQUENCIAL\]/g, numeroSequencialFormatado)
        // Substituir Acordado
        .replace(/\{\{ACORDADO\}\}/g, acordado || '[O que foi acordado será inserido aqui]')
        .replace(/\[ACORDADO\]/g, acordado || '[O que foi acordado será inserido aqui]');
      setConteudoGerado(texto);
    }
  }, [acordado, dataAta, numeroSequencial, template, aluno, ataExistente]);

  const titulo = ataExistente ? ataExistente.titulo : template.titulo;

  // Função para aprimorar com IA usando Gemini
  const handleEnhanceWithAI = async () => {
    if (!acordado.trim()) {
      alert('Por favor, digite o que foi acordado antes de aprimorar com a IA.');
      return;
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      alert('Chave de API do Gemini não configurada no arquivo .env.local. Se você adicionou a chave recentemente, pare e reinicie o seu servidor local (npm run dev) para carregar as novas variáveis de ambiente.');
      return;
    }

    try {
      setIsEnhancing(true);
      const prompt = `Você é o assistente oficial de redação da Escola Estadual José Barbosa Rodrigues. Sua tarefa é transformar o texto informal sobre o que foi acordado com o aluno/responsável em uma redação formal e de teor pedagógico em português, adequada para constar em uma Ata de Reunião escolar oficial. Mantenha o texto objetivo, profissional, em terceira pessoa, de forma coesa e clara. Evite saudações ou comentários. Retorne APENAS o texto aprimorado final da ata, sem introduções ou explicações.

Texto informal para aprimorar:
"${acordado}"`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let parsedError;
        try {
          parsedError = JSON.parse(errorText);
        } catch (_) {}

        const detailedMessage = parsedError?.error?.message || errorText || 'Erro desconhecido';
        const isQuotaError = response.status === 429 || detailedMessage.toLowerCase().includes('quota') || detailedMessage.toLowerCase().includes('limit');
        
        if (isQuotaError) {
          throw new Error(`Limite de Cota Excedido (Quota/Rate Limit Exceeded).\n\nSua chave de API do Gemini atingiu o limite ou a cota gratuita foi esgotada para esta conta.\n\nDetalhes do erro:\n${detailedMessage}`);
        } else {
          throw new Error(`Erro na API Gemini (Código ${response.status}):\n${detailedMessage}`);
        }
      }

      const data = await response.json();
      const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (textResult) {
        setAcordado(textResult.trim());
      } else {
        alert('Não foi possível obter uma resposta válida da IA. Tente novamente.');
      }
    } catch (error: any) {
      console.error('Erro ao chamar o Gemini:', error);
      alert(`Erro ao conectar com a IA do Gemini:\n\n${error.message || error}`);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Salvar ata no Supabase
  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Obter ou recalcular o número sequencial final para evitar duplicados
      let finalNum = numeroSequencial;
      if (!ataExistente && !finalNum) {
        const { data, error } = await supabase
          .from('atas_alunos')
          .select('numero_sequencial')
          .order('numero_sequencial', { ascending: false })
          .limit(1)
          .maybeSingle();
        finalNum = (data?.numero_sequencial || 0) + 1;
      }

      if (ataExistente) {
        // Atualizar ata existente
        const { error } = await supabase
          .from('atas_alunos')
          .update({
            data_ata: dataAta,
            acordado: acordado,
            conteudo_gerado: conteudoGerado
          })
          .eq('id', ataExistente.id);

        if (error) throw error;
        alert('Ata atualizada com sucesso!');
      } else {
        // Inserir nova ata
        const { error } = await supabase
          .from('atas_alunos')
          .insert({
            aluno_id: String(aluno.aluno_id).trim(),
            template_id: template.id,
            titulo: titulo,
            conteudo_gerado: conteudoGerado,
            numero_sequencial: finalNum,
            data_ata: dataAta,
            acordado: acordado,
            bimestre_id: bimestreAtual
          });

        if (error) throw error;
        alert('Ata salva com sucesso!');
      }

      onUploadSuccess();
      setMode('preview');
    } catch (error) {
      console.error('Erro ao salvar a ata:', error);
      alert('Erro ao salvar a ata no banco de dados. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Upload do anexo assinado
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      let ataId = ataExistente?.id;
      
      // Se não existir ID de ata, precisamos salvar a ata primeiro antes de anexar
      if (!ataId) {
        alert('Por favor, salve a ata antes de anexar o arquivo assinado.');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${aluno.aluno_id}_${ataId}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('atas_assinadas')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('atas_assinadas')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('atas_alunos')
        .update({ imagem_assinatura_url: publicUrlData.publicUrl })
        .eq('id', ataId);

      if (updateError) throw updateError;

      setUploadSuccess(true);
      setTimeout(() => {
        setUploadSuccess(false);
        onUploadSuccess();
      }, 2000);

    } catch (error) {
      console.error('Erro ao fazer upload da ata assinada:', error);
      alert('Erro ao enviar o documento assinado. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:p-0 print:bg-white print:block">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] max-h-[850px] flex flex-col shadow-2xl overflow-hidden print:shadow-none print:max-w-full print:rounded-none print:h-auto print:my-0">
        
        {/* HEADER - Oculto na impressão */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500 text-white rounded-xl shadow-md shadow-blue-500/10">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                {titulo} 
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 font-extrabold rounded-full">
                  Nº {numeroSequencialFormatado}
                </span>
              </h2>
              <p className="text-sm font-bold text-slate-500">{aluno.nome}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Abas de Modo (somente na criação/edição) */}
            <div className="flex bg-slate-150 p-1 rounded-xl mr-2">
              <button
                type="button"
                onClick={() => setMode('fill')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                  mode === 'fill' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" /> Redigir
              </button>
              <button
                type="button"
                onClick={() => setMode('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                  mode === 'preview' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Visualizar
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-600/15"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* CORPO DO MODAL */}
        <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 overflow-hidden print:block print:overflow-visible print:h-auto">
          
          {/* LADO ESQUERDO: Painel de Edição e Configuração (Oculto na impressão, e visível apenas no modo 'fill' em telas pequenas) */}
          <div className={`w-full md:w-1/2 flex flex-col justify-between bg-slate-50/50 print:hidden h-full ${mode === 'fill' ? 'block' : 'hidden md:flex'}`}>
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" /> Detalhes da Reunião
              </h3>

              {/* Data da Ata */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-2">Data da Reunião</label>
                <input
                  type="date"
                  value={dataAta}
                  onChange={(e) => setDataAta(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                />
              </div>

              {/* O que foi acordado / Entrada da IA */}
              <div className="flex flex-col flex-1">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-black text-slate-500 uppercase">
                    O que ficou acordado?
                  </label>
                  <button
                    type="button"
                    onClick={handleEnhanceWithAI}
                    disabled={isEnhancing || !acordado.trim()}
                    className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-slate-200 disabled:to-slate-200 text-white text-[11px] font-black rounded-lg transition-all shadow-md shadow-orange-500/10 disabled:shadow-none"
                  >
                    {isEnhancing ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Aprimorando...</>
                    ) : (
                      <><Sparkles className="w-3 h-3 text-amber-100" /> ✨ Aprimorar com IA</>
                    )}
                  </button>
                </div>
                <textarea
                  value={acordado}
                  onChange={(e) => setAcordado(e.target.value)}
                  placeholder="Ex: Conversamos com o pai sobre as faltas do aluno. O pai se comprometeu a acompanhar mais e trazer o aluno todos os dias..."
                  className="w-full h-44 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none shadow-sm text-sm leading-relaxed"
                />
                <p className="mt-1.5 text-[10px] text-slate-500 font-bold leading-normal">
                  💡 Escreva em linguagem simples e use a nossa IA para formalizar o texto automaticamente.
                </p>
              </div>

              {/* Edição direta do conteúdo gerado final */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-2">Edição Direta do Texto Final</label>
                <textarea
                  value={conteudoGerado}
                  onChange={(e) => setConteudoGerado(e.target.value)}
                  className="w-full h-44 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none shadow-sm text-sm font-mono leading-relaxed"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition-all shadow-lg shadow-blue-600/10 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                ) : (
                  <>Salvar Ata <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>

          {/* LADO DIREITO: Pré-visualização do Documento Impresso / Ata Oficial */}
          <div className={`w-full md:w-1/2 p-8 overflow-y-auto bg-white print:p-8 print:w-full print:block h-full ${mode === 'preview' ? 'block' : 'hidden md:block'}`}>
            
            {/* CABEÇALHO OFICIAL DA ESCOLA (Exibido na impressão e visualização) */}
            <div className="mb-8 pb-6 border-b-2 border-slate-900 text-center flex flex-col items-center">
              <div className="flex items-center justify-center gap-4 mb-3">
                <img 
                  src="/logo.png.png" 
                  alt="EE José Barbosa Rodrigues" 
                  className="w-16 h-16 object-contain" 
                  onError={(e) => {
                    // Fallback se falhar ao carregar o logo
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="text-left">
                  <h1 className="text-xl font-black uppercase text-slate-900 tracking-wide leading-tight">E.E. José Barbosa Rodrigues</h1>
                  <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider leading-none mt-1">Secretaria de Estado de Educação de Mato Grosso do Sul</p>
                </div>
              </div>
              <div className="w-full flex justify-between items-center mt-5 px-1 text-xs text-slate-700 font-black uppercase tracking-wider">
                <span>Ata de Reunião Nº: {numeroSequencialFormatado}</span>
                <span>Data: {dataExtensa}</span>
              </div>
            </div>

            {/* CONTEÚDO TEXTUAL DA ATA */}
            <div className="whitespace-pre-wrap text-slate-950 leading-loose text-justify font-serif text-base select-text min-h-[300px]">
              {conteudoGerado}
            </div>

            {/* SEÇÃO DE ASSINATURAS (Visível na visualização e impressão) */}
            <div className="mt-16 pt-8 border-t border-dashed border-slate-200">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-10 text-center print:text-black">Assinaturas</h4>
              <div className="grid grid-cols-2 gap-x-12 gap-y-12">
                <div className="text-center">
                  <div className="border-b border-slate-400 w-full mb-1"></div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Responsável pelo Aluno</span>
                </div>
                <div className="text-center">
                  <div className="border-b border-slate-400 w-full mb-1"></div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Coordenação Pedagógica</span>
                </div>
                <div className="text-center col-span-2 max-w-xs mx-auto w-full mt-4">
                  <div className="border-b border-slate-400 w-full mb-1"></div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Aluno</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* FOOTER UPLOAD - Oculto na impressão e visível somente se a ata existir */}
        {ataExistente && (
          <div className="p-6 border-t border-slate-100 bg-slate-50 print:hidden">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-bold space-y-1">
                <p>📋 1. Salve e imprima este documento usando o botão no topo.</p>
                <p>✍️ 2. Colete as assinaturas dos presentes fisicamente.</p>
                <p>📤 3. Tire uma foto ou escaneie o documento assinado e envie abaixo para arquivamento digital.</p>
              </div>
              
              <div className="flex flex-col items-center">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className={`flex items-center gap-2 px-6 py-3 text-xs font-black rounded-xl transition-all shadow-md ${
                    uploadSuccess
                      ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/20'
                      : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10'
                  }`}
                >
                  {uploadSuccess ? (
                    <><CheckCircle className="w-4 h-4" /> Enviado com sucesso!</>
                  ) : isUploading ? (
                    <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span> Enviando...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Anexar Ata Assinada</>
                  )}
                </button>
                
                {ataExistente?.imagem_assinatura_url && (
                  <a 
                    href={ataExistente.imagem_assinatura_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-3 text-[11px] font-black text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> Visualizar anexo de assinatura salvo
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
