import { redirect } from "next/navigation";

export default function RentPage() {
  redirect("/marketplace?type=RENT");
}
