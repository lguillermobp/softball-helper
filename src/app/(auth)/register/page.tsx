"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StepIndicator } from "@/components/layout/StepIndicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSelector } from "@/components/ui/language-selector";
import { useLanguage } from "@/context/language-context";
import {
  registerSchema,
  leagueSetupSchema,
  seasonSchema,
  type RegisterInput,
  type LeagueSetupInput,
  type SeasonInput,
} from "@/lib/validations";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const r = t.register;
  const p = r.plans;

  const PLANS = [
    { id: "free",    name: p.free.name,    price: 0,  description: p.free.description },
    { id: "starter", name: p.starter.name, price: 29, description: p.starter.description },
    { id: "pro",     name: p.pro.name,     price: 79, description: p.pro.description },
  ];

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [registrationData, setRegistrationData] = useState<{
    account?: RegisterInput;
    league?: LeagueSetupInput;
    season?: SeasonInput;
    categories: string[];
    teams: string[];
  }>({ categories: [], teams: [] });

  const accountForm = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });
  const leagueForm  = useForm<LeagueSetupInput>({ resolver: zodResolver(leagueSetupSchema) });
  const seasonForm  = useForm<SeasonInput>({ resolver: zodResolver(seasonSchema) });

  const [categories, setCategories] = useState<string[]>([""]);
  const [teams, setTeams]           = useState<string[]>([""]);
  const [selectedPlan, setSelectedPlan] = useState("");

  function handleAccountSubmit(data: RegisterInput) {
    setRegistrationData((prev) => ({ ...prev, account: data }));
    setStep(2);
  }

  function handleLeagueSubmit(data: LeagueSetupInput) {
    setRegistrationData((prev) => ({ ...prev, league: data }));
    setStep(3);
  }

  function handleSeasonSubmit(data: SeasonInput) {
    setRegistrationData((prev) => ({ ...prev, season: data }));
    setStep(4);
  }

  function handleCategoriesNext() {
    setRegistrationData((prev) => ({ ...prev, categories: categories.filter((c) => c.trim()) }));
    setStep(5);
  }

  async function handleFinalSubmit() {
    const filledTeams = teams.filter((t) => t.trim());
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...registrationData, teams: filledTeams }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Something went wrong"); setIsLoading(false); return; }
      router.push("/login?registered=1");
    } catch {
      setError("Network error. Please try again.");
      setIsLoading(false);
    }
  }

  const inputCls = "bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-green-500";
  const labelCls = "text-white/70";

  return (
    <div className="min-h-screen bg-[#0f1f0f]">
      {/* Language selector */}
      <div className="fixed top-4 right-4 z-10">
        <LanguageSelector />
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-1">
            <span className="text-2xl">🥎</span>
            <span className="text-2xl font-black text-white">
              Softball<span className="text-green-400">Helper</span>
            </span>
          </Link>
          <p className="text-sm text-white/40">{r.pageTitle}</p>
        </div>

        <StepIndicator currentStep={step} />

        <div className="mt-6">

          {/* ── Step 1 — Account ── */}
          {step === 1 && (
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader>
                <CardTitle className="text-white">{r.steps.account.title}</CardTitle>
                <CardDescription className="text-white/40">{r.steps.account.subtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={accountForm.handleSubmit(handleAccountSubmit)} className="space-y-4">
                  <div className="space-y-1">
                    <Label className={labelCls}>{r.steps.account.name}</Label>
                    <Input className={inputCls} placeholder={r.steps.account.namePlaceholder} {...accountForm.register("name")} />
                    {accountForm.formState.errors.name && <p className="text-xs text-red-400">{accountForm.formState.errors.name.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className={labelCls}>{r.steps.account.email}</Label>
                    <Input className={inputCls} type="email" placeholder={r.steps.account.emailPlaceholder} {...accountForm.register("email")} />
                    {accountForm.formState.errors.email && <p className="text-xs text-red-400">{accountForm.formState.errors.email.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className={labelCls}>{r.steps.account.password}</Label>
                    <Input className={inputCls} type="password" placeholder={r.steps.account.passwordPlaceholder} {...accountForm.register("password")} />
                    {accountForm.formState.errors.password && <p className="text-xs text-red-400">{accountForm.formState.errors.password.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className={labelCls}>{r.steps.account.confirmPassword}</Label>
                    <Input className={inputCls} type="password" {...accountForm.register("confirmPassword")} />
                    {accountForm.formState.errors.confirmPassword && <p className="text-xs text-red-400">{accountForm.formState.errors.confirmPassword.message}</p>}
                  </div>
                  <Button type="submit" className="w-full bg-green-500 hover:bg-green-400 text-black font-bold" size="lg">
                    {r.steps.account.continue}
                  </Button>
                  <p className="text-center text-sm text-white/40">
                    {r.steps.account.haveAccount}{" "}
                    <Link href="/login" className="text-green-400 font-medium hover:underline">{r.steps.account.signIn}</Link>
                  </p>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ── Step 2 — League ── */}
          {step === 2 && (
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader>
                <CardTitle className="text-white">{r.steps.league.title}</CardTitle>
                <CardDescription className="text-white/40">{r.steps.league.subtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={leagueForm.handleSubmit(handleLeagueSubmit)} className="space-y-4">
                  <div className="space-y-1">
                    <Label className={labelCls}>{r.steps.league.name}</Label>
                    <Input className={inputCls} placeholder={r.steps.league.namePlaceholder} {...leagueForm.register("name")} />
                    {leagueForm.formState.errors.name && <p className="text-xs text-red-400">{leagueForm.formState.errors.name.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className={labelCls}>{r.steps.league.city}</Label>
                      <Input className={inputCls} placeholder={r.steps.league.cityPlaceholder} {...leagueForm.register("city")} />
                    </div>
                    <div className="space-y-1">
                      <Label className={labelCls}>{r.steps.league.state}</Label>
                      <Input className={inputCls} placeholder={r.steps.league.statePlaceholder} maxLength={20} {...leagueForm.register("state")} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className={labelCls}>{r.steps.league.selectPlan}</Label>
                    <div className="grid gap-3">
                      {PLANS.map((plan) => (
                        <label key={plan.id} className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-colors ${selectedPlan === plan.id ? "border-green-500 bg-green-500/10" : "border-white/10 hover:border-white/20"}`}>
                          <input type="radio" className="sr-only" value={plan.id} {...leagueForm.register("planId")} onChange={() => setSelectedPlan(plan.id)} />
                          <div>
                            <p className="font-semibold text-white">{plan.name}</p>
                            <p className="text-sm text-white/40">{plan.description}</p>
                          </div>
                          <span className="text-lg font-bold text-green-400">
                            {plan.price === 0 ? (p.free.name) : `$${plan.price}/mo`}
                          </span>
                        </label>
                      ))}
                    </div>
                    {leagueForm.formState.errors.planId && <p className="text-xs text-red-400">{leagueForm.formState.errors.planId.message}</p>}
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/10 bg-transparent" onClick={() => setStep(1)}>{r.steps.league.back}</Button>
                    <Button type="submit" className="flex-1 bg-green-500 hover:bg-green-400 text-black font-bold" size="lg">{r.steps.league.continue}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ── Step 3 — Season ── */}
          {step === 3 && (
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader>
                <CardTitle className="text-white">{r.steps.season.title}</CardTitle>
                <CardDescription className="text-white/40">{r.steps.season.subtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={seasonForm.handleSubmit(handleSeasonSubmit)} className="space-y-4">
                  <div className="space-y-1">
                    <Label className={labelCls}>{r.steps.season.name}</Label>
                    <Input className={inputCls} placeholder={r.steps.season.namePlaceholder} {...seasonForm.register("name")} />
                    {seasonForm.formState.errors.name && <p className="text-xs text-red-400">{seasonForm.formState.errors.name.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className={labelCls}>{r.steps.season.startDate}</Label>
                      <Input className={inputCls} type="date" {...seasonForm.register("startDate")} />
                    </div>
                    <div className="space-y-1">
                      <Label className={labelCls}>{r.steps.season.endDate}</Label>
                      <Input className={inputCls} type="date" {...seasonForm.register("endDate")} />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/10 bg-transparent" onClick={() => setStep(2)}>{r.steps.season.back}</Button>
                    <Button type="submit" className="flex-1 bg-green-500 hover:bg-green-400 text-black font-bold" size="lg">{r.steps.season.continue}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ── Step 4 — Categories ── */}
          {step === 4 && (
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader>
                <CardTitle className="text-white">{r.steps.categories.title}</CardTitle>
                <CardDescription className="text-white/40">{r.steps.categories.subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {categories.map((cat, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        className={inputCls}
                        placeholder={`${r.steps.categories.placeholder} ${i + 1}`}
                        value={cat}
                        onChange={(e) => { const n = [...categories]; n[i] = e.target.value; setCategories(n); }}
                      />
                      {categories.length > 1 && (
                        <Button type="button" variant="outline" size="icon" className="border-white/10 text-white hover:bg-white/10 bg-transparent" onClick={() => setCategories(categories.filter((_, j) => j !== i))}>×</Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="ghost" className="w-full border border-dashed border-white/20 text-white/50 hover:text-white hover:bg-white/5" onClick={() => setCategories([...categories, ""])}>
                    {r.steps.categories.addBtn}
                  </Button>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/10 bg-transparent" onClick={() => setStep(3)}>{r.steps.categories.back}</Button>
                  <Button type="button" className="flex-1 bg-green-500 hover:bg-green-400 text-black font-bold" size="lg" onClick={handleCategoriesNext}>{r.steps.categories.continue}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step 5 — Teams ── */}
          {step === 5 && (
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader>
                <CardTitle className="text-white">{r.steps.teams.title}</CardTitle>
                <CardDescription className="text-white/40">{r.steps.teams.subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>
                )}
                <div className="space-y-2">
                  {teams.map((team, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        className={inputCls}
                        placeholder={`${r.steps.teams.placeholder} ${i + 1}`}
                        value={team}
                        onChange={(e) => { const n = [...teams]; n[i] = e.target.value; setTeams(n); }}
                      />
                      {teams.length > 1 && (
                        <Button type="button" variant="outline" size="icon" className="border-white/10 text-white hover:bg-white/10 bg-transparent" onClick={() => setTeams(teams.filter((_, j) => j !== i))}>×</Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="ghost" className="w-full border border-dashed border-white/20 text-white/50 hover:text-white hover:bg-white/5" onClick={() => setTeams([...teams, ""])}>
                    {r.steps.teams.addBtn}
                  </Button>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/10 bg-transparent" onClick={() => setStep(4)}>{r.steps.teams.back}</Button>
                  <Button type="button" className="flex-1 bg-green-500 hover:bg-green-400 text-black font-bold" size="lg" disabled={isLoading} onClick={handleFinalSubmit}>
                    {isLoading ? r.steps.teams.finishing : r.steps.teams.finish}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
