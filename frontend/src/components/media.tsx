import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { API_BASE } from '../api/client';
import { mediaToken } from '../api/endpoints';
import type { MediaToken } from '../api/types';

/** Short-lived, resource-scoped URL for <img>/<video> (browsers cannot send Authorization headers). Refreshed before expiry. */
export function useMediaToken(kind: string, id?: string | null) {
  return useQuery({ queryKey: ['media', kind, id], queryFn: () => mediaToken(kind, id as string), enabled: !!id, staleTime: 200_000, refetchInterval: 240_000 });
}
export const mediaUrl = (t: MediaToken, extra = '') => `${API_BASE}${t.path}?t=${encodeURIComponent(t.token)}${extra}`;

export function MediaImg({ kind, id, index, alt, className }: { kind: 'thumb' | 'frame' | 'evidence'; id?: string | null; index?: number; alt: string; className?: string }) {
  const { data } = useMediaToken(kind, id);
  const [failed, setFailed] = useState(false);
  const frozen = useRef<string | null>(null);
  if (data && !frozen.current) frozen.current = mediaUrl(data, index != null ? `&i=${index}` : '');
  if (failed || (!data && !frozen.current && !id)) return <div className={`img-ph ${className ?? ''}`} role="img" aria-label={alt}><ImageOff size={20} /></div>;
  return frozen.current ? <img className={className} src={frozen.current} alt={alt} loading="lazy" onError={() => setFailed(true)} /> : <div className={`img-ph ${className ?? ''}`} aria-busy />;
}
