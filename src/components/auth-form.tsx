"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { registerOrganization } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const registering = mode === "register";

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      if (registering) {
        const result = await registerOrganization(formData);
        if ("error" in result) {
          setError(result.error ?? "Unable to create the workspace.");
          return;
        }
        const login = await signIn("credentials", {
          email: result.email,
          organizationSlug: result.organizationSlug,
          password: formData.get("password"),
          redirect: false
        });
        if (login?.error) {
          toast.success("Workspace created. Sign in to continue.");
          router.push("/login");
          return;
        }
        router.push("/");
        router.refresh();
      } else {
        const result = await signIn("credentials", {
          organizationSlug: formData.get("organizationSlug"),
          email: formData.get("email"),
          password: formData.get("password"),
          redirect: false
        });
        if (result?.error) setError("Email or password is incorrect.");
        else {
          router.push("/");
          router.refresh();
        }
      }
    });
  }

  return (
    <form action={submit} className="space-y-4">
      {registering && (
        <>
          <label className="block space-y-1.5 text-sm font-medium text-ink">
            Your name
            <Input name="name" autoComplete="name" required minLength={2} maxLength={80} placeholder="Alex Morgan" />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-ink">
            Organization
            <Input name="organization" autoComplete="organization" required minLength={2} maxLength={80} placeholder="Acme Studio" />
          </label>
        </>
      )}
      {!registering && (
        <label className="block space-y-1.5 text-sm font-medium text-ink">
          Organization slug
          <Input name="organizationSlug" autoComplete="organization" required placeholder="acme-studio-a1b2c3d4" />
        </label>
      )}
      <label className="block space-y-1.5 text-sm font-medium text-ink">
        Work email
        <Input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@company.com" />
      </label>
      <label className="block space-y-1.5 text-sm font-medium text-ink">
        Password
        <Input
          name="password"
          type="password"
          autoComplete={registering ? "new-password" : "current-password"}
          required
          minLength={registering ? 12 : 1}
          maxLength={128}
          placeholder={registering ? "At least 12 characters" : "Your password"}
        />
      </label>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <Button className="w-full" disabled={pending}>
        {pending ? "Please wait..." : registering ? "Create secure workspace" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-muted">
        {registering ? "Already have an account? " : "New to TrustVault? "}
        <Link className="font-semibold text-brand hover:underline" href={registering ? "/login" : "/register"}>
          {registering ? "Sign in" : "Create a workspace"}
        </Link>
      </p>
    </form>
  );
}
