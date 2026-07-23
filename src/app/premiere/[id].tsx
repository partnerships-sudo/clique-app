import { Redirect, useLocalSearchParams } from 'expo-router';

export default function PremiereDeepLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/premiere-waiting-room', params: { id } }} />;
}
