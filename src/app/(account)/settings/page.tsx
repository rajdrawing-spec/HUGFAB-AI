import type { Metadata } from 'next';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { SignOutButton } from './sign-out-button';

export const metadata: Metadata = { title: 'Settings' };

/** Phase 0 shell: proves the server-side session is readable. */
export default async function SettingsPage() {
  const user = await requireUser('/settings');

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-h1">Settings</h1>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <Field label="Email" value={user.email ?? '—'} />
          <Field label="User ID" value={user.id} mono />
          <Field label="Role" value={user.role} />
        </CardBody>
      </Card>

      <div className="mt-6">
        <SignOutButton />
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-caption text-muted tracking-wide uppercase">{label}</span>
      <span className={mono ? 'text-small font-mono break-all' : 'text-body'}>
        {value}
      </span>
    </div>
  );
}
