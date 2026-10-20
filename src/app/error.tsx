"use client";

import Link from "next/link";
import { ErrorState } from "@/components/states/States";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <ErrorState
      frame="page"
      heading="h1"
      title="The lights flickered."
      body="Something on this page stopped working. Saved profiles and areas stay in your account; try again, or head back to the start."
    >
      <button type="button" onClick={() => retry()}>
        Try again
      </button>
      <Link href="/">Go to the home page</Link>
    </ErrorState>
  );
}
