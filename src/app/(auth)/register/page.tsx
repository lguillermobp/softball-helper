import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const session = await auth();
  const loggedInUser = session?.user?.id
    ? { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null }
    : null;

  // Real plans from the DB (with their actual ids) so the plan the user picks
  // matches what the registration endpoint looks up by id.
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
    select: { id: true, name: true, price: true, maxGames: true },
  });

  return <RegisterForm loggedInUser={loggedInUser} plans={plans} />;
}
