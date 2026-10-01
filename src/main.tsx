console.log('Main.tsx loading...');
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'katex/dist/katex.min.css'
import App from './App.tsx'
import { AuthProvider } from './hooks/useAuth'
import { ErroCarregamento } from './components/ErroCarregamento'
import { recarregarSeChunkAntigo } from './utils/recarregarSeChunkAntigo'

// O Vite avisa quando falha o pré-carregamento de um arquivo de tela (versão antiga da página).
window.addEventListener('vite:preloadError', (evento) => {
  if (recarregarSeChunkAntigo()) evento.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErroCarregamento>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErroCarregamento>
  </StrictMode>,
)
