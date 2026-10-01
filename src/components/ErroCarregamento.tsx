import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

// Última rede de segurança: se uma tela falhar ao carregar (ex.: sem internet, arquivo novo ainda
// não disponível), mostra um aviso com botão em vez de deixar a página inteira em branco.
export class ErroCarregamento extends Component<Props, { erro: boolean }> {
  state = { erro: false };

  static getDerivedStateFromError() {
    return { erro: true };
  }

  componentDidCatch(erro: unknown) {
    console.error('Falha ao exibir a tela:', erro);
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 360, textAlign: 'center' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#003366', margin: 0 }}>Não foi possível abrir esta tela</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '8px 0 16px' }}>
            O portal foi atualizado ou a conexão falhou. Atualize a página para continuar.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', background: '#003366', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
          >
            Atualizar a página
          </button>
        </div>
      </div>
    );
  }
}
