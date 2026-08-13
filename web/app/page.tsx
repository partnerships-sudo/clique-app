import { redirect } from 'next/navigation';
import { createClient } from '@web/lib/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? '/feed' : '/login');
}
