import type { TipoDocumentoPessoa } from '../types/secretaria';

// Categorias de documentos da ficha do servidor (rótulo e texto do campo de descrição).
export const CATEGORIAS_SERVIDOR: {
  tipo: TipoDocumentoPessoa;
  rotulo: string;
  rotuloDescricao: string;
  placeholder: string;
  descricaoObrigatoria: boolean;
}[] = [
  { tipo: 'CERTIFICADO', rotulo: 'Certificados', rotuloDescricao: 'Descrição do certificado', placeholder: 'Ex.: Curso de Libras, 120 h — SED/MS, 2025', descricaoObrigatoria: true },
  { tipo: 'DOCUMENTO_PESSOAL', rotulo: 'Documentos pessoais', rotuloDescricao: 'Qual documento', placeholder: 'Ex.: RG (frente e verso), CPF, comprovante de residência', descricaoObrigatoria: true },
  { tipo: 'ATESTADO_MEDICO', rotulo: 'Atestados médicos', rotuloDescricao: 'Descrição / período', placeholder: 'Ex.: 3 dias a partir de 10/09/2026 (opcional)', descricaoObrigatoria: false },
  { tipo: 'TERMO_CONVOCACAO_ASSINADO', rotulo: 'Termos assinados', rotuloDescricao: 'Descrição', placeholder: 'Ex.: Termo de convocação, 01/10 a 18/12/2026 (opcional)', descricaoObrigatoria: false },
  { tipo: 'OUTRO', rotulo: 'Outros', rotuloDescricao: 'Descrição', placeholder: 'O que é este documento', descricaoObrigatoria: true },
];
