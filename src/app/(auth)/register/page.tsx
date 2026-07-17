import { auth } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const session = await auth();
  const loggedInUser = session?.user?.id
    ? { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null }
    : null;

  return <RegisterForm loggedInUser={loggedInUser} />;
}
