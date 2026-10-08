import { redirect } from "next/navigation";

// Legacy route from the initial structure; the item list now lives at /all-items.
export default function BacklogPage() {
  redirect("/all-items");
}
