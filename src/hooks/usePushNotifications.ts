import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function timeoutPromise<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export type NotificationPermission = 'default' | 'granted' | 'denied';

interface UsePushNotificationsReturn {
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  supported: boolean;
  registration: ServiceWorkerRegistration | null;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  // Register service worker on mount
  useEffect(() => {
    if (!supported) return;

    setPermission(Notification.permission as NotificationPermission);

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        setRegistration(reg);
        // Check if already subscribed
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        if (sub) setIsSubscribed(true);
      })
      .catch((err) => console.error('SW registration failed:', err));
  }, [supported]);

  // Listen for service worker messages (subscription change)
  useEffect(() => {
    if (!supported) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        saveSubscription(event.data.subscription);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [supported]);

  const saveSubscription = useCallback(async (subscription: PushSubscription) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const subJson = subscription.toJSON();
    const keys = subJson.keys as { p256dh: string; auth: string };

    if (!keys || !keys.p256dh || !keys.auth) {
      throw new Error('Chaves da assinatura digital inválidas ou ausentes.');
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' }
    );

    if (error) throw error;
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported || !registration) return;
    setIsLoading(true);
    try {
      // 1. Pedir permissão com timeout (evita travamento se o navegador bloquear ou ignorar)
      const perm = await timeoutPromise(
        Notification.requestPermission(),
        10000,
        'O navegador demorou muito para responder à permissão de notificações.'
      );

      setPermission(perm as NotificationPermission);
      if (perm !== 'granted') {
        setIsLoading(false);
        return;
      }

      // 2. Gerar assinatura digital com timeout
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer;
      const subscription = await timeoutPromise(
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        }),
        8000,
        'Não foi possível gerar a assinatura digital. Em guias anônimas ou navegação privada, o navegador bloqueia o serviço de notificações push por segurança.'
      );

      // 3. Salvar no banco com timeout
      await timeoutPromise(
        saveSubscription(subscription),
        8000,
        'Tempo limite esgotado ao salvar sua inscrição de notificações. Verifique sua conexão.'
      );

      setIsSubscribed(true);
    } catch (err: any) {
      console.error('Push subscribe error:', err);
      alert(`Falha ao ativar notificações:\n\n${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  }, [supported, registration, saveSubscription]);

  const unsubscribe = useCallback(async () => {
    if (!supported || !registration) return;
    setIsLoading(true);
    try {
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', sub.endpoint);
        }
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('Push unsubscribe error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supported, registration]);

  return { permission, isSubscribed, isLoading, subscribe, unsubscribe, supported, registration };
}
