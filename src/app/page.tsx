import { redirect } from "next/navigation";
import { DEFAULT_REDIRECT } from "@/constants/auth";

// The app's home is Overview; signed-out visitors are sent on to the login page by the AuthGate.
export default function Home() {
  redirect(DEFAULT_REDIRECT);
}
