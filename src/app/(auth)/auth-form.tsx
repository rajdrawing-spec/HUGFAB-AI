'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, useToast } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { clientEnv } from '@/lib/env.client';
import { track } from '@/lib/analytics';

export type AuthMode = 'login' | 'signup';

const COPY = {
  login: {
    title: 'Log in',
    submit: 'Log in',
    switchPrompt: 'New to HugFab?',
    switchLabel: 'Create an account',
    switchHref: '/signup',
  },
  signup: {
    title: 'Create your account',
    submit: 'Create account',
    switchPrompt: 'Already have an account?',
    switchLabel: 'Log in',
    switchHref: '/login',
  },
} as const;

/**
 * Phase 0 auth shell. Functional, deliberately plain — the designed screens
 * land in Phase 1 alongside docs/ui-ux-guide.md (PRD §56).
 */
export function AuthForm({ mode }: { mode: AuthMode }) {
  const copy = COPY[mode];
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  const configured = Boolean(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL && clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const next = searchParams.get('next') ?? '/';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    try {
      const supabase = createClient();

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${clientEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        track('signed_up');
        toast('Check your inbox to confirm your email address.', 'success');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        track('signed_in');
        router.push(next);
        router.refresh();
      }
    } catch (error) {
      // Supabase messages are already user-safe and deliberately vague about
      // whether an account exists.
      toast(error instanceof Error ? error.message : 'Something went wrong.', 'error');
    } finally {
      setPending(false);
    }
  }

  async function onGoogle() {
    setPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${clientEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) throw error;
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Something went wrong.', 'error');
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="text-h1">{copy.title}</h1>

      {!configured && (
        <p
          role="status"
          className="text-small border-warning bg-warning-soft text-warning mt-4 rounded-md border px-3 py-2"
        >
          Authentication is not configured in this environment. Add your Supabase keys to{' '}
          <code>.env.local</code> — see <code>.env.example</code>.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!configured || pending}
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
          minLength={8}
          hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={!configured || pending}
        />

        <Button type="submit" fullWidth loading={pending} disabled={!configured}>
          {copy.submit}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-caption text-muted">or</span>
        <span className="bg-border h-px flex-1" />
      </div>

      <Button
        variant="outline"
        fullWidth
        onClick={onGoogle}
        disabled={!configured || pending}
      >
        Continue with Google
      </Button>

      <p className="text-small text-muted mt-8 text-center">
        {copy.switchPrompt}{' '}
        <Link href={copy.switchHref} className="text-primary hover:underline">
          {copy.switchLabel}
        </Link>
      </p>
    </div>
  );
}
