/**
 * Shared furniture for the legal and contact pages.
 *
 * Kept in one place rather than copied per page because these three documents
 * are read as a set — a heading that is a different size on the Terms than on
 * the Privacy Policy reads as two documents from two sources, which is exactly
 * the wrong signal on pages whose whole job is to look accountable.
 */

export function LegalPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-h1 text-balance">{title}</h1>

      <p className="text-caption text-muted mt-4 tracking-wide uppercase">
        Last updated {updated}
      </p>

      <p className="text-body-lg text-muted mt-5">{intro}</p>

      {children}
    </div>
  );
}

export function LegalSection({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    /*
      Numbered because these are clauses. A reader quoting one back to us in a
      complaint needs to be able to name it, and "section 7" is the only form
      of reference a document like this reliably supports.
    */
    <section className="border-border mt-10 border-t pt-7">
      <h2 className="text-h3">
        <span className="text-muted mr-2 font-normal tabular-nums">{n}.</span>
        {title}
      </h2>
      <div className="text-body text-muted mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-none flex-col gap-3 p-0">{children}</ul>;
}

export function LegalItem({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <li className="border-border-strong border-l-2 pl-4">
      <b className="text-text block font-semibold">{term}</b>
      <span>{children}</span>
    </li>
  );
}
