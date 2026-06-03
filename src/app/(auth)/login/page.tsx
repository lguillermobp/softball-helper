"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSelector } from "@/components/ui/language-selector";
import { useLanguage } from "@/context/language-context";
import { loginSchema, type LoginInput } from "@/lib/validations";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const { t } = useLanguage();
  const l = t.login;

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setIsLoading(true);
    setError("");
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
    if (result?.error) {
      setError(l.invalidError);
      setIsLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#0f1f0f] flex items-center justify-center px-4">
      {/* Language selector top-right */}
      <div className="fixed top-4 right-4 z-10">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Softball Helper" className="h-16 w-auto" />
          </Link>
          <p className="text-sm text-white/40">{l.pageTitle}</p>
        </div>

        {registered && (
          <div className="mb-4 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400">
            {l.successMsg}
          </div>
        )}

        <Card className="bg-white/5 border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-white">{l.title}</CardTitle>
            <CardDescription className="text-white/40">{l.subtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="email" className="text-white/70">{l.email}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={l.emailPlaceholder}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-green-500"
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-red-400">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="password" className="text-white/70">{l.password}</Label>
                <Input
                  id="password"
                  type="password"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-green-500"
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-xs text-red-400">{form.formState.errors.password.message}</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full bg-green-500 hover:bg-green-400 text-black font-bold"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? l.signingIn : l.signinBtn}
              </Button>
              <p className="text-center text-sm text-white/40">
                {l.noAccount}{" "}
                <Link href="/register" className="text-green-400 font-medium hover:underline">
                  {l.createOne}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
