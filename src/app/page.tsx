import LoginPage from "@/features/auth/components/LoginPage";

// The login page is the main address. A user who is already signed in is sent on to their home page by the login page itself.
export default function Home() {
  return <LoginPage />;
}
