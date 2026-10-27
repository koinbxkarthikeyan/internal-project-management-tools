import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/constants/auth";

// The login page used to live here; old /login links and bookmarks go to the main address.
export default function Page() {
  redirect(LOGIN_PATH);
}
