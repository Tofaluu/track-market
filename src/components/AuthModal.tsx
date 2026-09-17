import { useState, useEffect } from "preact/hooks";
import { store } from "../state";
import { supabase } from "../services/supabase";

export function AuthModal() {
  const isOpen = store.isAuthModalOpen.value;

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      setErrorMsg("");
      setSuccessMsg("");
      setIsLogin(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        store.isAuthModalOpen.value = false;
      } else {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        if (!username.trim()) {
          throw new Error("Username is required.");
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim(),
            },
          },
        });
        if (error) throw error;
        setSuccessMsg("Account created! You are now logged in.");
        setTimeout(() => {
          store.isAuthModalOpen.value = false;
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in"
      onClick={() => (store.isAuthModalOpen.value = false)}
    >
      <div
        class="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-lg font-bold text-white">
              {isLogin ? "Sign In" : "Create Account"}
            </h3>
            <p class="text-xs text-zinc-400">
              {isLogin
                ? "Welcome back to TrackMarket"
                : "Join to start paper trading"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => (store.isAuthModalOpen.value = false)}
            class="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} class="space-y-4">
          {!isLogin && (
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-zinc-300">
                Username
              </label>
              <input
                type="text"
                required={!isLogin}
                value={username}
                onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
                placeholder="WarrenBuffett99"
                class="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
              />
            </div>
          )}
          <div>
            <label class="mb-1.5 block text-xs font-semibold text-zinc-300">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              placeholder="investor@example.com"
              class="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-xs font-semibold text-zinc-300">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              placeholder="••••••••"
              class="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </div>
          {!isLogin && (
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-zinc-300">
                Confirm Password
              </label>
              <input
                type="password"
                required={!isLogin}
                minLength={6}
                value={confirmPassword}
                onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
                placeholder="••••••••"
                class="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
              />
            </div>
          )}

          {errorMsg && (
            <div class="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-400 border border-rose-500/20">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div class="rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-400 border border-emerald-500/20">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            class="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-violet-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <div class="mt-6 text-center text-xs text-zinc-400">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setErrorMsg("");
              setSuccessMsg("");
            }}
            class="font-semibold text-violet-400 hover:text-violet-300 hover:underline"
          >
            {isLogin ? "Create one" : "Sign in instead"}
          </button>
        </div>
      </div>
    </div>
  );
}
