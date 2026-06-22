import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 text-center">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-base font-bold text-white">
          S
        </span>
        <span className="text-2xl font-semibold tracking-tight text-slate-900">
          SlotSync
        </span>
      </div>
      <h1 className="max-w-xl text-4xl font-bold tracking-tight text-slate-900">
        Booking that never double-books.
      </h1>
      <p className="mt-4 max-w-md text-slate-500">
        Scheduling for salons, clinics, and consultants — with deposits,
        reminders, and rock-solid availability.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/signup"
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
