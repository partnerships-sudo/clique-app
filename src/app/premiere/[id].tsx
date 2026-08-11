import { Redirect, useLocalSearchParams } from 'expo-router';
import { usePremiere } from '@/features/premieres/api';

export default function PremiereDeepLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: premiere, isLoading } = usePremiere(id ?? null);

  if (isLoading || !premiere) {
    // Still loading — default to waiting room; it will redirect once status is known
    return <Redirect href={{ pathname: '/premiere-waiting-room', params: { id } }} />;
  }

  if (premiere.status === 'live') {
    return <Redirect href={{ pathname: '/premiere-live', params: { id } }} />;
  }

  if (premiere.status === 'ended') {
    return <Redirect href={{ pathname: '/premiere-replay', params: { id } }} />;
  }

  return <Redirect href={{ pathname: '/premiere-waiting-room', params: { id } }} />;
}
