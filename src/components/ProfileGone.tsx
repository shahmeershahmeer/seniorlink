import { UserX } from "lucide-react";
import Link from "next/link";

/** Shown when a profile no longer exists (removed, or the demo was reset). */
export default function ProfileGone() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sand text-muted">
        <UserX size={40} />
      </span>
      <h1 className="text-3xl font-semibold">This profile isn&apos;t available</h1>
      <p className="text-lg text-muted">It may have been removed. Choose another profile or join SeniorLink.</p>
      <Link href="/" className="w-full rounded-3xl bg-brand py-5 text-xl font-semibold text-white">
        Back to SeniorLink
      </Link>
    </main>
  );
}
