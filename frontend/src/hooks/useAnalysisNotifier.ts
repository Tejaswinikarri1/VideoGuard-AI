import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { listAnalyses } from '../api/endpoints';
import { useToast } from '../components/Toast';
import { readPref } from '../prefs';

/** Detects real status transitions (running -> completed/failed) in the user's analyses and notifies (toast + optional browser notification). */
export function useAnalysisNotifier() {
  const toast = useToast();
  const prev = useRef<Map<string, string> | null>(null);
  const q = useQuery({ queryKey: ['notifier'], queryFn: () => listAnalyses({ size: 20 }), refetchInterval: 10000 });
  useEffect(() => {
    if (!q.data) return;
    if (prev.current && readPref('notifyAnalysis', true)) {
      for (const a of q.data.items) {
        const was = prev.current.get(a.id);
        if ((was === 'QUEUED' || was === 'RUNNING') && (a.status === 'COMPLETED' || a.status === 'FAILED')) {
          const ok = a.status === 'COMPLETED';
          const msg = ok ? `Analysis finished for ${a.videoName}: ${a.eventCount} event${a.eventCount === 1 ? '' : 's'} to review.` : `Analysis failed for ${a.videoName}.`;
          toast(msg, ok ? 'success' : 'error');
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('VideoGuard AI', { body: msg });
        }
      }
    }
    prev.current = new Map(q.data.items.map((a) => [a.id, a.status]));
  }, [q.data, toast]);
}
