import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
    Plus, 
    Trash2, 
    Loader2, 
    User, 
    BookOpen, 
    Layers, 
    Search, 
    Filter,
    Save,
    X,
    CheckCircle2,
    AlertCircle,
    Calendar,
    Stethoscope,
    ArrowRightLeft
} from 'lucide-react';

interface Allocation {
    id: string;
    professor_id: string;
    turma_id: string;
    disciplina_id: string;
    professor_nome?: string;
    turma_nome?: string;
    disciplina_nome?: string;
    is_espelho?: boolean;
    atestado_id?: string | null;
    professor_original_id?: string | null;
    professor_original_nome?: string;
    atestado_data_fim?: string;
}

interface Entity {
    id: string;
    nome: string;
    nivel?: string;
    official?: boolean;
}

export function AllocationManager() {
    const [allocations, setAllocations] = useState<Allocation[]>([]);
    const [professors, setProfessors] = useState<Entity[]>([]);
    const [turmas, setTurmas] = useState<Entity[]>([]);
    const [disciplinas, setDisciplinas] = useState<Entity[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        professor_id: '',
        turma_id: '',
        disciplina_id: ''
    });
    const [isAllocating, setIsAllocating] = useState(false);
    const [selectedProfessorId, setSelectedProfessorId] = useState<string>('all');
    const [filterSearch, setFilterSearch] = useState<string>('');
    const [cleaningUp, setCleaningUp] = useState(false);

    function normalizeStr(str: string) {
        if (!str) return '';
        return str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    async function handleAutoAllocation() {
        if (!confirm('Deseja iniciar a alocação automática de professores baseada nos horários cadastrados? O sistema criará novos vínculos sem remover os já existentes.')) {
            return;
        }

        setIsAllocating(true);
        try {
            const { data: schedules, error: errSched } = await supabase.from('horarios').select('*');
            if (errSched) throw errSched;

            const { data: discs, error: errDisc } = await supabase.from('disciplinas').select('*');
            if (errDisc) throw errDisc;

            if (!schedules || schedules.length === 0) {
                alert('Não há horários cadastrados no sistema para gerar as alocações.');
                return;
            }

            const disciplineMap = new Map<string, string>();
            discs?.forEach(d => {
                disciplineMap.set(normalizeStr(d.nome), d.id);
            });

            const existingKeys = new Set(
                allocations.map(a => `${a.professor_id}_${a.turma_id}_${a.disciplina_id}`)
            );

            const uniqueCombos = new Map<string, { professor_id: string, turma_id: string, disciplina_nome: string }>();
            schedules.forEach(h => {
                const key = `${h.professor_id}_${h.turma_id}_${h.disciplina_nome.trim()}`;
                if (!uniqueCombos.has(key)) {
                    uniqueCombos.set(key, {
                        professor_id: h.professor_id,
                        turma_id: h.turma_id,
                        disciplina_nome: h.disciplina_nome.trim()
                    });
                }
            });

            const toInsert: { professor_id: string, turma_id: string, disciplina_id: string }[] = [];
            
            for (const [_, val] of uniqueCombos.entries()) {
                const normSchedName = normalizeStr(val.disciplina_nome);
                let discId = disciplineMap.get(normSchedName);

                if (!discId && discs) {
                    for (const d of discs) {
                        const normDName = normalizeStr(d.nome);
                        if (normSchedName.startsWith(normDName) || normDName.startsWith(normSchedName)) {
                            discId = d.id;
                            break;
                        }
                    }
                }

                if (discId) {
                    const allocKey = `${val.professor_id}_${val.turma_id}_${discId}`;
                    if (!existingKeys.has(allocKey)) {
                        toInsert.push({
                            professor_id: val.professor_id,
                            turma_id: val.turma_id,
                            disciplina_id: discId
                        });
                    }
                }
            }

            if (toInsert.length === 0) {
                alert('Todas as alocações dos horários já estão cadastradas no sistema. Nenhuma alocação nova foi criada.');
                return;
            }

            const { error: errInsert } = await supabase.from('alocacoes_v2').insert(toInsert);
            if (errInsert) throw errInsert;

            alert(`Sucesso! Foram criados ${toInsert.length} novos vínculos de alocação automaticamente com base nos horários.`);
            await fetchData();
        } catch (err: any) {
            alert('Falha na alocação automática: ' + err.message);
            console.error(err);
        } finally {
            setIsAllocating(false);
        }
    }

    useEffect(() => {
        fetchData();
        expireAtestadosVencidos();
    }, []);

    async function expireAtestadosVencidos() {
        setCleaningUp(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            // Buscar atestados que passaram da data de fim mas ainda estão ativos
            const { data: vencidos } = await supabase
                .from('atestados_servidores')
                .select('id')
                .eq('ativo', true)
                .lt('data_fim', today);

            if (vencidos && vencidos.length > 0) {
                for (const atestado of vencidos) {
                    // Remover espelhos deste atestado
                    await supabase
                        .from('alocacoes_v2')
                        .delete()
                        .eq('atestado_id', atestado.id)
                        .eq('is_espelho', true);

                    // Marcar atestado como inativo
                    await supabase
                        .from('atestados_servidores')
                        .update({ ativo: false })
                        .eq('id', atestado.id);
                }
                console.log(`${vencidos.length} atestado(s) expirado(s) processado(s).`);
            }
        } catch (err) {
            console.warn('Aviso: falha ao expirar atestados:', err);
        } finally {
            setCleaningUp(false);
        }
    }

    async function fetchData() {
        setLoading(true);
        
        // 1. Busca Professores
        const { data: profs } = await supabase.from('professores').select('id, nome').order('nome');
        if (profs) setProfessors(profs);

        // 2. Buscar Turmas e Disciplinas (Novas + Legadas)
        const { data: nT } = await supabase.from('turmas').select('id, nome, nivel');
        const { data: nD } = await supabase.from('disciplinas').select('id, nome');
        const { data: legacyData } = await supabase.from('lista_para_vistos').select('turma_id, turma_nome, disciplina_id, disciplina_nome');
        
        let allTurmas: any[] = (nT || []).map(t => ({ ...t, official: true }));
        let allDiscs: any[] = (nD || []).map(d => ({ ...d, official: true }));

        if (legacyData) {
            legacyData.forEach(item => {
                if (!allTurmas.find(t => t.nome === item.turma_nome)) {
                    allTurmas.push({ id: item.turma_id, nome: item.turma_nome, official: false, nivel: 'Legado' });
                }
                if (!allDiscs.find(d => d.nome === item.disciplina_nome)) {
                    allDiscs.push({ id: item.disciplina_id, nome: item.disciplina_nome, official: false });
                }
            });
        }
        
        setTurmas(allTurmas.sort((a, b) => a.nome.localeCompare(b.nome)));
        setDisciplinas(allDiscs.sort((a, b) => a.nome.localeCompare(b.nome)));

        // 3. Buscar Alocações com tratamento de erro + dados de espelho
        const { data: allocs, error } = await supabase.from('alocacoes_v2').select(`
            id,
            professor_id,
            turma_id,
            disciplina_id,
            is_espelho,
            atestado_id,
            professor_original_id,
            professores!inner(nome),
            turmas!inner(nome),
            disciplinas!inner(nome)
        `);

        // Buscar atestados para enriquecer dados de espelho
        const { data: atestados } = await supabase
            .from('atestados_servidores')
            .select('id, data_fim, professor_id');

        if (error) {
            console.error('Erro ao buscar alocações:', error);
            const { data: simpleAllocs } = await supabase.from('alocacoes_v2').select('*');
            if (simpleAllocs) {
                setAllocations(simpleAllocs.map((a: any) => ({
                    ...a,
                    professor_nome: profs?.find(p => p.id === a.professor_id)?.nome || 'Professor',
                    turma_nome: allTurmas.find(t => t.id === a.turma_id)?.nome || 'Turma',
                    disciplina_nome: allDiscs.find(d => d.id === a.disciplina_id)?.nome || 'Disciplina'
                })));
            }
        } else if (allocs) {
            setAllocations(allocs.map((a: any) => {
                const atestado = atestados?.find(at => at.id === a.atestado_id);
                const professorOriginal = profs?.find(p => p.id === a.professor_original_id);
                return {
                    id: a.id,
                    professor_id: a.professor_id,
                    turma_id: a.turma_id,
                    disciplina_id: a.disciplina_id,
                    is_espelho: a.is_espelho || false,
                    atestado_id: a.atestado_id,
                    professor_original_id: a.professor_original_id,
                    professor_nome: a.professores?.nome || 'Professor',
                    turma_nome: a.turmas?.nome || 'Turma',
                    disciplina_nome: a.disciplinas?.nome || 'Disciplina',
                    professor_original_nome: professorOriginal?.nome,
                    atestado_data_fim: atestado?.data_fim
                };
            }));
        }
        
        setLoading(false);
    }

    function isUUID(str: string) {
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return regex.test(str);
    }

    async function handleAdd() {
        if (!formData.professor_id || !formData.turma_id || !formData.disciplina_id) {
            alert('Por favor, selecione Professor, Turma e Disciplina.');
            return;
        }

        // 1. Verificar se QUALQUER professor já ocupa esta vaga (Turma + Disciplina)
        const existingAllocation = allocations.find(a => 
            a.turma_id === formData.turma_id && 
            a.disciplina_id === formData.disciplina_id
        );

        if (existingAllocation) {
            const profName = professors.find(p => p.id === existingAllocation.professor_id)?.nome || 'outro docente';
            alert(`Atenção: A disciplina selecionada já possui o professor "${profName}" alocado nesta turma. Não é possível cadastrar dois professores para a mesma matéria.`);
            return;
        }

        try {
            const { data, error } = await supabase.from('alocacoes_v2').insert([formData]).select();
            
            if (error) {
                if (error.code === '23505') throw new Error('Esta disciplina já está ocupada nesta turma por outro professor!');
                throw error;
            }

            alert('Vínculo salvo com sucesso!');
            setIsModalOpen(false);
            setFormData({ professor_id: '', turma_id: '', disciplina_id: '' });
            fetchData();
        } catch (err: any) {
            alert('Falha ao gravar: ' + err.message);
            console.error(err);
        }
    }

    async function handleDelete(id: string) {
        if (confirm('Deseja remover este vínculo?')) {
            await supabase.from('alocacoes_v2').delete().eq('id', id);
            fetchData();
        }
    }

    const filteredProfs = professors.filter(prof => {
        if (selectedProfessorId !== 'all' && prof.id !== selectedProfessorId) {
            return false;
        }
        if (filterSearch && !prof.nome.toLowerCase().includes(filterSearch.toLowerCase())) {
            return false;
        }
        return true;
    });

    return (
        <div className="w-full min-h-full relative pb-24">
            <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Vínculos de Ensino</h2>
                    <p className="text-[#003366] mt-1 font-bold">Gerencie a distribuição de professores nas turmas e disciplinas</p>
                </div>
                <button
                    onClick={handleAutoAllocation}
                    disabled={isAllocating}
                    className="flex items-center gap-3 px-6 py-3.5 bg-ms-blue hover:bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-blue-900/40"
                >
                    {isAllocating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Alocando...</span>
                        </>
                    ) : (
                        <>
                            <Calendar className="w-4 h-4" />
                            <span>Alocação Automática</span>
                        </>
                    )}
                </button>
            </div>

            {/* Seletor e Filtro do Professor */}
            <div className="mb-8 flex flex-col md:flex-row gap-6 items-center justify-between bg-ms-card p-6 border border-gray-800 rounded-[2.5rem] w-full max-w-5xl mx-auto shadow-lg shadow-black/20">
                <div className="flex-1 w-full relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Buscar por nome do professor..."
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 bg-ms-dark border-2 border-gray-800 rounded-2xl text-ms-main placeholder-gray-500 outline-none focus:border-ms-blue focus:ring-4 focus:ring-ms-blue/10 font-bold transition-all"
                    />
                </div>
                <div className="w-full md:w-80 relative">
                    <select
                        value={selectedProfessorId}
                        onChange={(e) => setSelectedProfessorId(e.target.value)}
                        className="w-full px-6 py-4 bg-ms-dark border-2 border-gray-800 rounded-2xl text-ms-main font-bold outline-none focus:border-ms-blue focus:ring-4 focus:ring-ms-blue/10 cursor-pointer appearance-none"
                    >
                        <option value="all">Ver Todos os Professores</option>
                        {professors.map(p => (
                            <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                        <Filter className="w-4 h-4 text-ms-blue" />
                    </div>
                </div>
            </div>

            {/* Lista de Professores - Layout Vertical em Coluna Única */}
            <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto">
                {loading ? (
                    <div className="py-40 text-center">
                        <Loader2 className="w-12 h-12 animate-spin mx-auto text-ms-blue mb-4" />
                        <p className="text-gray-400 font-medium text-lg">Organizando lista...</p>
                    </div>
                ) : filteredProfs.length === 0 ? (
                    <div className="py-20 text-center bg-ms-card rounded-[2rem] border border-dashed border-gray-800">
                        <User className="w-16 h-16 mx-auto mb-4 text-gray-800" />
                        <p className="text-gray-500 font-bold text-xl">Nenhum professor encontrado com os filtros atuais.</p>
                    </div>
                ) : filteredProfs.map(prof => {
                    const profAllocs = allocations
                        .filter(a => a.professor_id === prof.id)
                        .sort((a, b) => (a.turma_nome || '').localeCompare(b.turma_nome || ''));
                    
                    if (profAllocs.length === 0) {
                        if (selectedProfessorId !== 'all') {
                            return (
                                <div key={prof.id} className="py-20 text-center bg-ms-card rounded-[2rem] border border-dashed border-gray-800">
                                    <User className="w-16 h-16 mx-auto mb-4 text-gray-800" />
                                    <p className="text-gray-400 font-black text-xl uppercase tracking-widest leading-none">{prof.nome}</p>
                                    <p className="text-gray-500 font-bold text-base mt-3">Este docente não possui nenhum vínculo de ensino cadastrado.</p>
                                </div>
                            );
                        }
                        return null;
                    }

                    return (
                        <div key={prof.id} className="bg-ms-card border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:border-ms-blue/30 transition-all group">
                            {/* Cabeçalho do Professor */}
                            <div className="px-10 py-6 bg-gradient-to-r from-gray-800/30 via-transparent to-transparent border-b border-gray-800 flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-ms-blue/10 flex items-center justify-center text-ms-blue font-black border border-ms-blue/20 text-2xl shadow-inner group-hover:scale-105 transition-transform">
                                        {prof.nome.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-ms-blue uppercase tracking-tight leading-tight">{prof.nome}</h3>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="px-3 py-1 rounded-full text-[10px] font-black bg-ms-blue/10 text-ms-blue border border-ms-blue/20 uppercase tracking-widest">
                                                {profAllocs.length} {profAllocs.length === 1 ? 'TURMA' : 'TURMAS'} / {new Set(profAllocs.map(a => a.disciplina_id)).size} {new Set(profAllocs.map(a => a.disciplina_id)).size === 1 ? 'DISCIPLINA' : 'DISCIPLINAS'}
                                            </span>
                                            <span className="w-1 h-1 rounded-full bg-gray-700"></span>
                                            <p className="text-xs text-gray-500 font-bold uppercase tracking-tighter">ID: {prof.id.slice(0, 8)}...</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Tabela de Vínculos do Professor */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-[10px] font-black text-white uppercase tracking-[0.25em] border-b border-blue-900 bg-[#003366] shadow-md">
                                            <th className="px-10 py-3 text-left">Turma / Série</th>
                                            <th className="px-10 py-3 text-left">Disciplina / Matéria</th>
                                            <th className="px-10 py-3 text-right w-20">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800/50">
                                        {profAllocs.map(alloc => (
                                            <tr key={alloc.id} className={`transition-colors group/row ${alloc.is_espelho ? 'bg-amber-400/5 hover:bg-amber-400/10 border-l-2 border-l-amber-400/50' : 'hover:bg-ms-blue/5'}`}>
                                                <td className="px-10 py-2.5">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${alloc.is_espelho ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'bg-ms-blue shadow-[0_0_10px_rgba(0,102,255,0.5)]'}`}></div>
                                                        <span className={`text-sm font-black uppercase tracking-tight ${alloc.is_espelho ? 'text-amber-400' : 'text-ms-blue'}`}>{alloc.turma_nome}</span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-2.5">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-3">
                                                            <BookOpen className={`w-4 h-4 ${alloc.is_espelho ? 'text-amber-400' : 'text-ms-blue'}`} />
                                                            <span className={`text-sm font-bold ${alloc.is_espelho ? 'text-amber-400' : 'text-ms-blue'}`}>{alloc.disciplina_nome}</span>
                                                        </div>
                                                        {alloc.is_espelho && alloc.professor_original_nome && (
                                                            <div className="flex items-center gap-1.5 ml-7">
                                                                <ArrowRightLeft className="w-3 h-3 text-amber-500/60" />
                                                                <span className="text-[10px] font-bold text-amber-500/80">
                                                                    Substituindo: {alloc.professor_original_nome}
                                                                    {alloc.atestado_data_fim && ` · até ${new Date(alloc.atestado_data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-10 py-2.5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {alloc.is_espelho && (
                                                            <span className="flex items-center gap-1 px-2 py-1 bg-amber-400/10 text-amber-400 border border-amber-400/20 rounded-lg text-[9px] font-black">
                                                                <Stethoscope className="w-2.5 h-2.5" />
                                                                ESPELHO
                                                            </span>
                                                        )}
                                                        {!alloc.is_espelho && (
                                                            <button 
                                                                onClick={() => handleDelete(alloc.id)}
                                                                className="p-2 text-ms-blue hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                                                title="Excluir alocação"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Botão Flutuante Superior (Fixo) */}
            <div className="fixed bottom-12 right-12 z-[100]">
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="group flex items-center gap-4 px-10 py-6 bg-ms-blue text-white rounded-[2rem] font-black shadow-[0_25px_60px_-15px_rgba(0,102,255,0.5)] hover:bg-blue-600 hover:-translate-y-2 transition-all active:scale-95"
                >
                    <div className="bg-white/20 p-2 rounded-xl group-hover:rotate-90 transition-transform duration-300">
                        <Plus className="w-8 h-8" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Painel de Acesso</p>
                        <p className="text-lg uppercase tracking-tight">Novo Vínculo</p>
                    </div>
                </button>
            </div>

            {/* Modal Ultra Moderno */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-ms-card w-full max-w-xl rounded-[3rem] border border-gray-800 shadow-[0_0_150px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="px-12 py-10 border-b border-gray-800 bg-gradient-to-br from-ms-blue/20 via-transparent to-transparent flex items-center justify-between">
                            <div>
                                <h3 className="text-3xl font-black text-ms-main tracking-tighter uppercase italic">Nova Alocação</h3>
                                <p className="text-ms-blue font-black text-[10px] uppercase tracking-[0.4em] mt-2">Sistema de Gestão JBR</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-4 hover:bg-white/5 rounded-full text-gray-500 hover:text-white transition-all">
                                <X className="w-8 h-8" />
                            </button>
                        </div>

                        <div className="p-12 space-y-10">
                            {/* Seleção de Professor */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] ml-2 flex items-center gap-3">
                                    <User className="w-4 h-4 text-ms-blue" /> Selecione o Professor
                                </label>
                                <select 
                                    value={formData.professor_id}
                                    onChange={(e) => setFormData({...formData, professor_id: e.target.value})}
                                    className="w-full px-8 py-5 bg-ms-dark border-2 border-gray-800 rounded-3xl text-ms-main outline-none focus:border-ms-blue focus:ring-4 focus:ring-ms-blue/10 font-bold text-base transition-all hover:bg-gray-800/50 appearance-none cursor-pointer"
                                >
                                    <option value="">Buscar docente...</option>
                                    {professors.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Seleção de Turma */}
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] ml-2 flex items-center gap-3">
                                        <Layers className="w-4 h-4 text-ms-blue" /> Turma
                                    </label>
                                    <select 
                                        value={formData.turma_id}
                                        onChange={(e) => setFormData({...formData, turma_id: e.target.value})}
                                        className="w-full px-6 py-5 bg-ms-dark border-2 border-gray-800 rounded-3xl text-ms-main outline-none focus:border-ms-blue focus:ring-4 focus:ring-ms-blue/10 font-bold text-sm transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Série...</option>
                                        {turmas.map(t => (
                                            <option key={t.id} value={t.id}>
                                                {t.nome} {t.nivel ? `(${t.nivel})` : ''} {!t.official ? '⚠️' : '✅'}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Seleção de Disciplina */}
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] ml-2 flex items-center gap-3">
                                        <BookOpen className="w-4 h-4 text-ms-blue" /> Disciplina
                                    </label>
                                    <select 
                                        value={formData.disciplina_id}
                                        onChange={(e) => setFormData({...formData, disciplina_id: e.target.value})}
                                        className="w-full px-6 py-5 bg-ms-dark border-2 border-gray-800 rounded-3xl text-ms-main outline-none focus:border-ms-blue focus:ring-4 focus:ring-ms-blue/10 font-bold text-sm transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Matéria...</option>
                                        {disciplinas.map(d => (
                                            <option key={d.id} value={d.id}>
                                                {d.nome} {!d.official ? '⚠️' : '✅'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="px-12 py-10 bg-gray-950/50 border-t border-gray-800 flex items-center justify-between">
                            <button onClick={() => setIsModalOpen(false)} className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] hover:text-white transition-colors">
                                Descartar
                            </button>
                            <button 
                                onClick={handleAdd}
                                className="flex items-center gap-4 px-12 py-5 bg-ms-blue text-white rounded-[2rem] font-black hover:bg-blue-600 transition-all shadow-[0_15px_40px_rgba(0,102,255,0.3)] uppercase tracking-widest text-xs"
                            >
                                <Save className="w-5 h-5" />
                                Confirmar Vínculo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
