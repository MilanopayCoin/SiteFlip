import { redirect } from "next/navigation";

export default function BuyPage() {
  redirect("/marketplace?type=BUY");
}
