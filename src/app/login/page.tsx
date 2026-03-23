"use client";

import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-900 text-white p-8">
      <h1 className="text-2xl font-semibold">Rendering engine</h1>
      <p className="text-gray-400 text-center max-w-md">
        Sign-in UI placeholder. Open the mine site viewer (requires manifest API on port 8080).
      </p>
      <Link
        href="/mapview"
        className="rounded-lg bg-blue-600 hover:bg-blue-500 px-6 py-3 font-medium transition-colors"
      >
        Open map view
      </Link>
    </main>
  );
}
