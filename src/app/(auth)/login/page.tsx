import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthForm } from '../auth-form';

export const metadata: Metadata = {
  title: 'Log in',
  // Not content. Indexing a sign-in form earns nothing and spends
  // crawl budget that belongs to the catalogue.
  robots: { index: false, follow: false },
  alternates: { canonical: '/login' },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
