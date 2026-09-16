import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthForm } from '../auth-form';

export const metadata: Metadata = {
  title: 'Sign up',
  // Not content. Indexing a sign-in form earns nothing and spends
  // crawl budget that belongs to the catalogue.
  robots: { index: false, follow: false },
  alternates: { canonical: '/signup' },
};

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
