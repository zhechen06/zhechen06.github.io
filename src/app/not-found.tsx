import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-custom py-24">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ui-accent">404</p>
        <h1 className="mt-4 font-serif text-4xl font-bold text-ui-heading">Page not found</h1>
        <p className="mt-4 text-ui-muted">
          The page you are looking for may have moved or is no longer available.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
