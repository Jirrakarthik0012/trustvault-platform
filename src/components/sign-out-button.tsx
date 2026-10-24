"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <Button
      variant="ghost"
      size="small"
      className={compact ? "px-2" : "w-full justify-start"}
      onClick={() => signOut({ callbackUrl: "/login" })}
      aria-label="Sign out"
    >
      <LogOut size={15} />
      {!compact && "Sign out"}
    </Button>
  );
}
