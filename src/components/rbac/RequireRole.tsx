import type { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { Papel } from '../../types/rbac';

interface RequireRoleProps {
  anyOf: Papel[];
  children: ReactNode;
  fallback?: ReactNode;
}

// Guard central de UI reutilizável pelos próximos módulos:
//   <RequireRole anyOf={['SECRETARIA', 'GESTAO']}>...</RequireRole>
// Isto só evita renderizar algo que o back-end recusaria de qualquer forma — a
// barreira real é a Row Level Security no Postgres (usuario_tem_papel() nas
// policies de cada tabela).
export function RequireRole({ anyOf, children, fallback = null }: RequireRoleProps) {
  const { hasAnyRole, loading } = useAuth();
  if (loading) return null;
  // GESTAO sempre passa, mesmo se um módulo futuro esquecer de listar 'GESTAO' em
  // roles — mesma garantia de modulosVisiveis() (config/moduleNav.ts): o card
  // aparece pro admin, então o acesso também precisa abrir.
  if (!hasAnyRole([...anyOf, 'GESTAO'])) return <>{fallback}</>;
  return <>{children}</>;
}
