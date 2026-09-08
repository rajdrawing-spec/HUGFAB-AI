'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, useToast } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { resetAnalyticsIdentity } from '@/lib/analytics';

export function SignOutButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      await createClient().auth.signOut();
      resetAnalyticsIdentity();
      router.push('/');
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not sign out.', 'error');
      setPending(false);
    }
  }

  return (
    <Button variant="outline" onClick={onClick} loading={pending}>
      Sign out
    </Button>
  );
}
