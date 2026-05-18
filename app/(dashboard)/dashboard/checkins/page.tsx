import type { Metadata } from "next";
import CheckinsPageClient from "./checkins-client";

export const metadata: Metadata = {
  title: "Check-ins",
};

export default function CheckinsPage() {
  return <CheckinsPageClient />;
}
