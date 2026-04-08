import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_BASE } from '../config.js';

const WS_URL = WS_BASE;
const RECONNECT_DELAY = 3000;

export function useWebSocket() {
  const [projects, setProjects] = useState([]);
  const [projectStatuses, setProjectStatuses] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const previousStatusesRef = useRef({});

  // Richiedi permesso notifiche (DISABILITATO)
  // useEffect(() => {
  //   if ('Notification' in window && Notification.permission === 'default') {
  //     Notification.requestPermission();
  //   }
  // }, []);

  // Mostra notifica cambio stato (DISABILITATO)
  const showNotification = useCallback((projectName, oldStatus, newStatus, slug) => {
    // Notifiche disabilitate
    // if ('Notification' in window && Notification.permission === 'granted') {
    //   const statusEmoji = newStatus === 'active' ? '🟢' : '⚪';
    //   const title = `${statusEmoji} ${projectName}`;
    //   const body = slug
    //     ? `${oldStatus === 'active' ? 'Inattivo' : 'Attivo'} - ${slug}`
    //     : `Stato: ${oldStatus === 'active' ? 'Inattivo' : 'Attivo'}`;
    //
    //   new Notification(title, {
    //     body,
    //     icon: '/vite.svg',
    //     tag: projectName  // Previene notifiche duplicate
    //   });
    // }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log('🔌 Connessione a WebSocket...');
    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('✅ WebSocket connesso');
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'config') {
            console.log('📋 Ricevuta configurazione progetti:', message.projects);
            setProjects(message.projects);
          } else if (message.type === 'status') {
            console.log('📊 Aggiornamento status:', message.data.projectName);

            // Controlla se lo stato è cambiato
            const projectName = message.data.projectName;
            const oldStatus = previousStatusesRef.current[projectName]?.status;
            const newStatus = message.data.status;

            // Notifiche disabilitate
            // if (oldStatus && oldStatus !== newStatus) {
            //   showNotification(projectName, oldStatus, newStatus, message.data.slug);
            // }

            // Aggiorna gli stati
            previousStatusesRef.current[projectName] = message.data;
            setProjectStatuses((prev) => ({
              ...prev,
              [projectName]: message.data
            }));
          }
        } catch (error) {
          console.error('❌ Errore parsing messaggio:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ Errore WebSocket:', error);
        setConnectionStatus('error');
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnesso');
        setConnectionStatus('disconnected');
        wsRef.current = null;

        // Riconnessione automatica
        reconnectAttemptsRef.current += 1;
        console.log(`🔄 Tentativo riconnessione ${reconnectAttemptsRef.current} in ${RECONNECT_DELAY / 1000}s...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ Errore creazione WebSocket:', error);
      setConnectionStatus('error');
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { projects, projectStatuses, connectionStatus };
}
