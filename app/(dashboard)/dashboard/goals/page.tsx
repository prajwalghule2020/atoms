import type { Metadata } from "next";

import GoalsPageClient from "./goals-client";

export const metadata: Metadata = {
  title: "My Goals",
};

export const dynamic = "force-dynamic";

export default function GoalsPage() {
  return <GoalsPageClient />;
}
