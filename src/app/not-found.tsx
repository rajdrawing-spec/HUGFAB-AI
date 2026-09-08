import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start px-4 py-24 sm:px-6">
      <p className="text-caption text-primary font-medium tracking-[0.14em] uppercase">
        404
      </p>
      <h1 className="text-h1 mt-3">We could not find that page</h1>
      <p className="text-body text-muted mt-3">
        The link may be out of date, or the page may not exist yet — HugFab is being built
        one phase at a time.
      </p>
      <Link
        href="/"
        className="text-button bg-primary text-primary-foreground hover:bg-primary-hover mt-8 inline-flex h-11 items-center rounded-lg px-5 font-medium transition-colors"
      >
        Back to home
      </Link>
    </div>
  );
}
