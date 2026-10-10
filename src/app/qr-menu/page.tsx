import { redirect } from "next/navigation";

/** Product home lives at `/` — keep /qr-menu as alias */
export default function QrMenuAliasPage() {
  redirect("/");
}
