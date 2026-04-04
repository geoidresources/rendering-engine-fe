"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { FaApple, FaGoogle, FaWindows } from "react-icons/fa";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { useMutation } from "@tanstack/react-query";
import { loginUser } from "./api";
import { toast } from "sonner";
import type { LoginFormErrors } from "./type";
import { AUTH_TOKEN_KEY, AUTH_SESSION_KEY } from "@/lib/constants";

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
      toast.error("Login Failed,Check Username and Password");
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
    setFieldErrors({});
    loginMutation.mutate({ email, password });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleLogin();
  }

  return (
    <main className="min-h-screen flex text-zinc-900 dark:text-zinc-100 flex-col items-center justify-center bg-[#f5f5f7] dark:bg-black p-4 relative overflow-hidden font-sans transition-colors duration-300">
      {/* Top Right Theme Switcher */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeSwitcher />
      </div>

      {/* Background Gradients (Apple-like subtle blurs) */}
      <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Apple-style Form Card */}
        <div className="bg-white/90 dark:bg-[#1c1c1e]/90 border border-black/5 dark:border-white/10 shadow-2xl backdrop-blur-2xl rounded-[28px] p-8 sm:p-10 flex flex-col transition-colors duration-300">

          {/* Logo / Header */}
          <div className="flex flex-col items-center mb-8 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                <line x1="9" y1="3" x2="9" y2="18" />
                <line x1="15" y1="6" x2="15" y2="21" />
              </svg>
            </div>
            <div className="text-center">
              <h1 className="text-[26px] font-semibold text-zinc-900 dark:text-white tracking-tight">Sign in</h1>
              <p className="text-zinc-500 dark:text-[#a1a1a6] text-[15px] mt-1">
                Access your Geoid resources
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            {/* Unified Inputs Block (Apple-style) */}
            <div className="flex flex-col">
              <div className={`flex flex-col bg-zinc-50 dark:bg-[#2c2c2e] rounded-xl border ${fieldErrors.email || fieldErrors.password ? "border-red-500/50" : "border-black/10 dark:border-white/10"
                } overflow-hidden focus-within:border-black/20 dark:focus-within:border-white/30 transition-colors`}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent px-4 py-3.5 text-[15px] text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-[#8e8e93] border-b border-black/10 dark:border-white/10 outline-none focus:bg-zinc-100 dark:focus:bg-[#3a3a3c]/50 transition-colors"
                />
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-transparent px-4 py-3.5 pr-11 text-[15px] text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-[#8e8e93] outline-none focus:bg-zinc-100 dark:focus:bg-[#3a3a3c]/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-[#8e8e93] hover:text-zinc-900 dark:hover:text-white transition-colors p-1"
                  >
                    {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </div>

              {(fieldErrors.email || fieldErrors.password) && (
                <div className="text-[13px] text-red-500 dark:text-red-400 mt-2 px-1 font-medium">
                  {fieldErrors.email || fieldErrors.password}
                </div>
              )}
            </div>

            {/* Main Sign In Button */}
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full bg-[#0a84ff] hover:bg-[#007aff] text-white h-[46px] rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-70 mt-1"
            >
              {isLoading && (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {isLoading ? "Signing in…" : "Sign In"}
            </button>

            <div className="flex justify-center mt-[-4px]">
              <Link href="#" className="text-[#0a84ff] text-[14px] hover:text-[#5eb0ff] transition-colors">
                Forgot password?
              </Link>
            </div>

            {/* SSO Separator */}
            <div className="flex items-center gap-4 my-2">
              <div className="h-[1px] flex-1 bg-black/10 dark:bg-white/10" />
              <span className="text-zinc-500 dark:text-[#8e8e93] text-[13px] font-medium">or continue with</span>
              <div className="h-[1px] flex-1 bg-black/10 dark:bg-white/10" />
            </div>

            {/* SSO Buttons */}
            <div className="flex flex-col gap-3">
              <button className="w-full bg-white dark:bg-white text-black hover:bg-gray-50 dark:hover:bg-gray-100 border border-black/10 dark:border-transparent h-[46px] rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2.5 transition-colors">
                <FaGoogle size={20} className="mb-[2px]" />
                Continue with Google
              </button>

              <div className="flex gap-3">
                <button className="flex-1 bg-zinc-100 dark:bg-[#2c2c2e] hover:bg-zinc-200 dark:hover:bg-[#3a3a3c] text-zinc-900 dark:text-white h-[46px] rounded-xl text-[14px] font-medium flex items-center justify-center gap-2.5 transition-colors border border-black/5 dark:border-white/5">
                  <FaApple size={17} />
                  Apple
                </button>
                <button className="flex-1 bg-zinc-100 dark:bg-[#2c2c2e] hover:bg-zinc-200 dark:hover:bg-[#3a3a3c] text-zinc-900 dark:text-white h-[46px] rounded-xl text-[14px] font-medium flex items-center justify-center gap-2.5 transition-colors border border-black/5 dark:border-white/5">
                  <FaWindows size={17} />
                  Microsoft
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Text */}
        <p className="text-center text-zinc-500 dark:text-[#8e8e93] text-[13px] mt-8">
          Need access?{" "}
          <Link href="#" className="text-[#0a84ff] hover:text-[#5eb0ff]">
            Contact your administrator
          </Link>
        </p>
      </div>
    </main>
  );
}