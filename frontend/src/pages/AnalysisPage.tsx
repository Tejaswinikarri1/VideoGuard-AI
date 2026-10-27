import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getAnalysis } from '../api/endpoints';
import { ErrorState, Spinner } from '../components/ui';
import { AnalysisProgress } from './AnalysisProgress';
import { AnalysisResults } from './AnalysisResults';

/** One route, two views: progress while active/failed/cancelled, results once completed. Polls every 3 s while active. */
export default function AnalysisPage() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['analysis', id], queryFn: () => getAnalysis(id), refetchInterval: (query) => (['QUEUED', 'RUNNING'].includes(query.state.data?.status ?? '') ? 3000 : false) });
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorState message="This analysis was not found or you do not have access to it." onRetry={() => q.refetch()} />;
  return q.data.status === 'COMPLETED' ? <AnalysisResults a={q.data} /> : <AnalysisProgress a={q.data} />;
}
