import { redirect } from "next/navigation";

/** Legacy path — next.config also redirects /explore → /marketplace */
export default function ExplorePage() {
  redirect("/marketplace");
}
