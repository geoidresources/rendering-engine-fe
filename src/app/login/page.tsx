"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Map } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { loginUser } from "./api";
import { toast } from "sonner";
import type { LoginFormErrors } from "./type";
import { AUTH_TOKEN_KEY, AUTH_SESSION_KEY } from "@/lib/constants";
import { shouldRedirectToMaintenance } from "@/lib/maintenance";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFormErrors>({});

  const loginMutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (response) => {
      localStorage.setItem(AUTH_TOKEN_KEY, response.token);
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(response));
      router.push("/home");
    },
    onError: () => {
      toast.error("Login Failed, Check Username and Password");
    },
  });

  const isLoading = loginMutation.isPending;

  function validate(): LoginFormErrors {
    const errs: LoginFormErrors = {};
    if (!email) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "Enter a valid email";
    if (!password) errs.password = "Password is required";
    return errs;
  }

  function handleLogin() {
    const errs = validate();
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    if (shouldRedirectToMaintenance(email)) {
      router.replace("/maintenance");
      return;
    }

    setFieldErrors({});
    loginMutation.mutate({ email, password });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleLogin();
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-bg-base p-4 relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-accent/5 rounded-full blur-[160px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Login Card */}
        <div className="bg-bg-surface/95 border border-border-subtle backdrop-blur-xl rounded-sm p-8 sm:p-10 flex flex-col">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8 gap-4">
            <div className="w-14 h-14 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Map size={28} className="text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-text-primary uppercase tracking-wider">
                GEOID System
              </h1>
              <p className="text-text-muted text-xs uppercase tracking-wider mt-1">
                Subterranean Intelligence Network
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            {/* Inputs */}
            <div className="flex flex-col">
              <div className={`flex flex-col bg-bg-elevated rounded-sm border overflow-hidden ${
                fieldErrors.email || fieldErrors.password
                  ? "border-error/50"
                  : "border-border-subtle focus-within:border-primary"
              } transition-colors`}>
                <input
                  type="email"
                  placeholder="EMAIL"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent px-4 py-3.5 text-xs font-mono uppercase tracking-wider text-text-primary placeholder:text-text-muted border-b border-border-subtle outline-none focus:bg-bg-base/50 transition-colors"
                />
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="PASSWORD"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-transparent px-4 py-3.5 pr-11 text-xs font-mono uppercase tracking-wider text-text-primary placeholder:text-text-muted outline-none focus:bg-bg-base/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors p-1 bg-transparent border-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {(fieldErrors.email || fieldErrors.password) && (
                <div className="text-xs text-error mt-2 px-1 font-mono">
                  {fieldErrors.email || fieldErrors.password}
                </div>
              )}
            </div>

            {/* Sign In Button */}
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full bg-accent hover:bg-accent-hover text-bg-base h-[46px] rounded-sm text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors disabled:opacity-70 cursor-pointer border-none"
            >
              {isLoading && (
                <span className="w-4 h-4 border-2 border-bg-base/30 border-t-bg-base rounded-full animate-spin" />
              )}
              {isLoading ? "Authenticating..." : "Initialize Session"}
            </button>

            <div className="flex justify-center">
              <Link href="#" className="text-primary text-[10px] uppercase tracking-wider hover:text-primary-hover transition-colors">
                Forgot access credentials?
              </Link>
            </div>

            {/* SSO Separator */}
            <div className="flex items-center gap-4 my-1">
              <div className="h-px flex-1 bg-border-subtle" />
              <span className="text-text-muted text-[10px] uppercase tracking-wider">or authenticate via</span>
              <div className="h-px flex-1 bg-border-subtle" />
            </div>

            {/* SSO Buttons */}
            <div className="flex flex-col gap-2">
              <button className="w-full bg-bg-elevated hover:bg-bg-elevated/80 text-text-primary border border-border-subtle h-[42px] rounded-sm text-[10px] font-medium uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer">
                Continue with Google
              </button>
              <div className="flex gap-2">
                <button className="flex-1 bg-bg-elevated hover:bg-bg-elevated/80 text-text-secondary border border-border-subtle h-[42px] rounded-sm text-[10px] font-medium uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer">
                  Apple
                </button>
                <button className="flex-1 bg-bg-elevated hover:bg-bg-elevated/80 text-text-secondary border border-border-subtle h-[42px] rounded-sm text-[10px] font-medium uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer">
                  Microsoft
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-text-muted text-[10px] uppercase tracking-wider mt-6">
          Need access?{" "}
          <Link href="#" className="text-primary hover:text-primary-hover transition-colors">
            Contact your administrator
          </Link>
        </p>
      </div>
    </main>
  );
}
