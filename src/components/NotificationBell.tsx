import React, { useState } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface NotificationBellProps {
  className?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ className = '' }) => {
  const { permission, isSubscribed, isLoading, subscribe, unsubscribe, supported, registration } =
    usePushNotifications();
  const [showTooltip, setShowTooltip] = useState(false);

  if (!supported) return null;

  const handleClick = async () => {
    if (permission === 'denied') {
      alert(
        'As notificações estão bloqueadas nas configurações do seu navegador.\n\nPara ativar:\n1. Clique no ícone de cadeado 🔒 (ou informações do site) ao lado do endereço na barra de navegação.\n2. Altere a permissão de "Notificações" para "Permitir".\n3. Recarregue a página.'
      );
      return;
    }
    if (!supported) {
      alert('Notificações Push não são suportadas neste navegador/dispositivo.');
      return;
    }
    if (!registration) {
      alert('O sistema de notificações ainda está inicializando. Por favor, aguarde alguns segundos e tente novamente.');
      return;
    }

    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const getIcon = () => {
    if (isLoading) {
      return (
        <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      );
    }

    if (isSubscribed) {
      // Bell with notification dot (active)
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
          <circle cx="19" cy="5" r="4" fill="#22c55e" />
        </svg>
      );
    }

    if (permission === 'denied') {
      // Bell with slash (blocked)
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
          <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    }

    // Bell without dot (inactive)
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" opacity="0.6">
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
      </svg>
    );
  };

  const getTooltipText = () => {
    if (permission === 'denied')
      return 'Notificações bloqueadas no navegador. Clique para saber como ativar.';
    if (isSubscribed) return 'Notificações ativas — clique para desativar';
    return 'Ativar notificações push';
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={isLoading}
        title={getTooltipText()}
        style={{
          background: isSubscribed
            ? 'rgba(34, 197, 94, 0.15)'
            : 'rgba(255,255,255,0.08)',
          border: isSubscribed ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.15)',
          borderRadius: '12px',
          padding: '8px 10px',
          cursor: 'pointer',
          color: isSubscribed ? '#86efac' : 'rgba(255,255,255,0.7)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          fontWeight: 600,
          transition: 'all 0.2s',
          letterSpacing: '0.03em',
        }}
      >
        {getIcon()}
        <span style={{ display: window.innerWidth < 640 ? 'none' : 'inline' }}>
          {isSubscribed ? 'Notif. ON' : 'Notif. OFF'}
        </span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            right: 0,
            background: 'rgba(15,15,20,0.97)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.9)',
            whiteSpace: 'nowrap',
            zIndex: 9999,
            backdropFilter: 'blur(10px)',
            pointerEvents: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            maxWidth: '220px',
            wordBreak: 'break-word',
            whiteSpaceCollapse: 'preserve',
          }}
        >
          {getTooltipText()}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
