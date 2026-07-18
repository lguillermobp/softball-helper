"use client";

import { useState, useEffect, useRef } from "react";
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
  type RegisterInput,
  type LeagueSetupInput,
} from "@/lib/validations";

interface LoggedInUser { id: string; name: string | null; email: string | null }

interface Props { loggedInUser: LoggedInUser | null }

export function RegisterForm({ loggedInUser }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const r = t.register;
  const p = r.plans;

  const PLANS = [
    { id: "basic",   name: p.basic.name,   price: 9,  description: p.basic.description },
    { id: "starter", name: p.starter.name, price: 29, description: p.starter.description },
    { id: "pro",     name: p.pro.name,     price: 79, description: p.pro.description },
  ];

  // Logged-in users skip step 1
  const [step, setStep] = useState(loggedInUser ? 2 : 1);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [accountData, setAccountData] = useState<RegisterInput | null>(null);

  const accountForm = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });
  const leagueForm  = useForm<LeagueSetupInput>({ resolver: zodResolver(leagueSetupSchema) });

  const [selectedPlan,  setSelectedPlan]  = useState("");
  const [logoDataUrl,   setLogoDataUrl]   = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [couponCode,    setCouponCode]    = useState("");
  const [couponState,   setCouponState]   = useState<
    { status: "idle" } |
    { status: "checking" } |
    { status: "valid";   percentOff: number; duration: "ONCE" | "FOREVER"; message: string } |
    { status: "invalid"; message: string }
  >({ status: "idle" });
  const couponTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced coupon validation
  useEffect(() => {
    if (!couponCode.trim()) { setCouponState({ status: "idle" }); return; }
    setCouponState({ status: "checking" });
    if (couponTimer.current) clearTimeout(couponTimer.current);
    couponTimer.current = setTimeout(async () => {
      const email = loggedInUser?.email ?? accountData?.email ?? "";
      const res = await fetch(
        `/api/coupons/validate?code=${encodeURIComponent(couponCode.trim())}&email=${encodeURIComponent(email)}`
      );
      const data = await res.json();
      if (data.valid) {
        setCouponState({ status: "valid", percentOff: data.percentOff, duration: data.duration, message: data.message });
      } else {
        setCouponState({ status: "invalid", message: data.message });
      }
    }, 500);
    return () => { if (couponTimer.current) clearTimeout(couponTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponCode]);

  function handleAccountSubmit(data: RegisterInput) {
    setAccountData(data);
    setStep(2);
  }

  async function handleLeagueNext() {
    const valid = await leagueForm.trigger(["name"]);
    if (valid) setStep(3);
  }

  async function handleFinalSubmit(data: LeagueSetupInput) {
    setIsLoading(true);
    setError("");
    try {
      const leaguePayload = { ...data, couponCode: couponCode.trim() || undefined };

      const payload = loggedInUser
        ? { userId: loggedInUser.id, league: leaguePayload, logoDataUrl: logoDataUrl ?? undefined }
        : { account: accountData, league: leaguePayload, logoDataUrl: logoDataUrl ?? undefined };

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Something went wrong"); setIsLoading(false); return; }

      if (loggedInUser && json.leagueSlug) {
        router.push(`/league/${json.leagueSlug}`);
      } else {
        router.push("/login?registered=1");
      }
    } catch {
      setError("Network error. Please try again.");
      setIsLoading(false);
    }
  }

  const inputCls = "bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-green-500";
  const labelCls = "text-white/70";

  return (
    <div className="min-h-screen bg-[#0f1f0f]">
      <div className="fixed top-4 right-4 z-10">
        <LanguageSelector />
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-1">
            <span className="text-2xl">🥎</span>
            <span className="text-2xl font-black text-white">
              Softball<span className="text-green-400">Helper</span>
            </span>
          </Link>
          {loggedInUser ? (
            <p className="text-sm text-white/40">
              Creating a new league for <span className="text-green-400">{loggedInUser.name ?? "you"}</span>
            </p>
          ) : (
            <p className="text-sm text-white/40">{r.pageTitle}</p>
          )}
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

          {/* ── Step 2 — League Setup ── */}
          {step === 2 && (
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader>
                <CardTitle className="text-white">{r.steps.league.title}</CardTitle>
                <CardDescription className="text-white/40">{r.steps.league.subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Logo picker */}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden transition-opacity hover:opacity-80 focus:outline-none"
                    style={{ border: "2px dashed rgba(255,255,255,0.2)" }}
                    title="Upload league logo (optional)"
                  >
                    {logoDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoDataUrl} alt="Logo preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                        <span className="text-lg">🖼️</span>
                        <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>LOGO</span>
                      </div>
                    )}
                  </button>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                      style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", background: "transparent" }}
                    >
                      {logoDataUrl ? "Change logo" : "Upload logo"}
                    </button>
                    {logoDataUrl && (
                      <button
                        type="button"
                        onClick={() => { setLogoDataUrl(null); if (logoInputRef.current) logoInputRef.current.value = ""; }}
                        className="block text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                        style={{ color: "rgba(239,68,68,0.7)", background: "transparent" }}
                      >
                        Remove
                      </button>
                    )}
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Optional · PNG, JPG · max 5 MB</p>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => setLogoDataUrl(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>

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

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/10 bg-transparent"
                    onClick={() => loggedInUser ? router.push("/dashboard") : setStep(1)}>
                    {r.steps.league.back}
                  </Button>
                  <Button type="button" className="flex-1 bg-green-500 hover:bg-green-400 text-black font-bold" size="lg"
                    onClick={handleLeagueNext}>
                    {r.steps.league.continue}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Step 3 — Plan ── */}
          {step === 3 && (
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader>
                <CardTitle className="text-white">{r.steps.league.selectPlan}</CardTitle>
                <CardDescription className="text-white/40">Pick the plan that fits your league.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={leagueForm.handleSubmit(handleFinalSubmit)} className="space-y-4">
                  {error && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>
                  )}

                  <div className="grid gap-3">
                    {PLANS.map((plan) => {
                      const disc = couponState.status === "valid" ? couponState.percentOff : 0;
                      const discountedPrice = disc > 0 ? (plan.price * (1 - disc / 100)).toFixed(2) : null;
                      return (
                        <label key={plan.id} className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-colors ${selectedPlan === plan.id ? "border-green-500 bg-green-500/10" : "border-white/10 hover:border-white/20"}`}>
                          <input type="radio" className="sr-only" value={plan.id} {...leagueForm.register("planId")} onChange={() => setSelectedPlan(plan.id)} />
                          <div>
                            <p className="font-semibold text-white">{plan.name}</p>
                            <p className="text-sm text-white/40">{plan.description}</p>
                          </div>
                          <div className="text-right">
                            {discountedPrice ? (
                              <>
                                <span className="text-sm line-through text-white/30">${plan.price}/mo</span>
                                <span className="block text-lg font-bold text-green-400">${discountedPrice}/mo</span>
                              </>
                            ) : (
                              <span className="text-lg font-bold text-green-400">${plan.price}/mo</span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  {leagueForm.formState.errors.planId && <p className="text-xs text-red-400">{leagueForm.formState.errors.planId.message}</p>}

                  {/* Coupon code */}
                  <div className="space-y-1">
                    <Label className={labelCls}>Coupon code (optional)</Label>
                    <div className="relative">
                      <Input
                        className={inputCls}
                        placeholder="ENTER CODE"
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      />
                      {couponState.status === "checking" && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">Checking…</span>
                      )}
                      {couponState.status === "valid" && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-green-400">✓ {couponState.message}</span>
                      )}
                    </div>
                    {couponState.status === "invalid" && (
                      <p className="text-xs text-red-400">{couponState.message}</p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/10 bg-transparent"
                      onClick={() => setStep(2)}>
                      {r.steps.league.back}
                    </Button>
                    <Button type="submit" className="flex-1 bg-green-500 hover:bg-green-400 text-black font-bold" size="lg" disabled={isLoading}>
                      {isLoading ? r.steps.teams.finishing : r.steps.teams.finish}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
