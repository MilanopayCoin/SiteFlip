import { redirect } from "next/navigation";

export default function RevivePage() {
  redirect("/marketplace?type=REVIVE");
}
