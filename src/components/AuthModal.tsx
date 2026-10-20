// Sign-in / create-account dialog for paper trading and watchlist sync.
import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { store } from "../state";
import { supabase } from "../services/supabase";
import { Dialog, DialogHeader } from "./Dialog";
import { btn, input, size } from "./ui";

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function AuthModal() {
  if (!store.isAuthModalOpen.value) return null;
  return <AuthDialog />;
}

function Field({
  id,
  label,
  hint,
  ...inputProps
}: { id: string; label: string; hint?: string } & JSX.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div class="space-y-1.5">
      <label for={id} class="block text-sm font-medium text-ink-soft">
        {label}
      </label>
      <input id={id} aria-describedby={hint ? `${id}-hint` : undefined} class={`${input} h-9`} {...inputProps} />
      {hint && (
        <p id={`${id}-hint`} class="text-xs text-ink-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}

function AuthDialog() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const close = () => {
    store.isAuthModalOpen.value = false;
    store.authModalIntent.value = null;
  };

  const handleAuthSuccess = () => {
    const intent = store.authModalIntent.value;
    close();
    if (intent === "portfolio") store.activeTab.value = "portfolio";
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMsg("");

    try {
      if (!isValidEmail(email)) throw new Error("Enter a valid email address, like name@example.com.");

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        handleAuthSuccess();
        return;
      }

      const cleanUsername = username.trim();
      if (cleanUsername.length < 3) throw new Error("Usernames need at least 3 characters.");
      if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
        throw new Error("Usernames can only use letters, numbers and underscores.");
      }
      if (password !== confirmPassword) throw new Error("The two passwords don’t match.");

      const { data: existingUser } = await supabase
        .from("profiles")
        .select("username")
        .ilike("username", cleanUsername)
        .maybeSingle();
      if (existingUser) throw new Error(`“${cleanUsername}” is taken. Try another username.`);

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: cleanUsername } },
      });
      if (error) throw error;
      store.showToast(`Welcome, ${cleanUsername}. You have $100,000 CAD in paper money to trade.`);
      handleAuthSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const intentCopy =
    store.authModalIntent.value === "portfolio"
      ? "Sign in to open your paper-trading portfolio."
      : "Paper trade with $100,000 CAD and sync your watchlist.";

  return (
    <Dialog onClose={close} labelledBy="auth-title" width="max-w-sm">
      <DialogHeader
        id="auth-title"
        title={isLogin ? "Sign in" : "Create an account"}
        description={intentCopy}
        onClose={close}
      />

      <form onSubmit={handleSubmit} class="space-y-4 px-5 py-5" noValidate>
        {!isLogin && (
          <Field
            id="auth-username"
            label="Username"
            hint="Letters, numbers and underscores, at least 3 characters."
            type="text"
            autocomplete="username"
            required
            value={username}
            onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
          />
        )}
        <Field
          id="auth-email"
          label="Email"
          type="email"
          autocomplete="email"
          required
          data-autofocus
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
        />
        <Field
          id="auth-password"
          label="Password"
          hint={isLogin ? undefined : "At least 6 characters."}
          type="password"
          autocomplete={isLogin ? "current-password" : "new-password"}
          required
          minLength={6}
          value={password}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
        />
        {!isLogin && (
          <Field
            id="auth-confirm"
            label="Confirm password"
            type="password"
            autocomplete="new-password"
            required
            minLength={6}
            value={confirmPassword}
            onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
          />
        )}

        {errorMsg && (
          <p role="alert" class="text-sm text-down">
            {errorMsg}
          </p>
        )}

        <button type="submit" disabled={loading} class={`${btn.primary} ${size.lg} w-full`}>
          {loading ? (isLogin ? "Signing in…" : "Creating account…") : isLogin ? "Sign in" : "Create account"}
        </button>

        <p class="text-center text-sm text-ink-muted">
          {isLogin ? "New here? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setErrorMsg("");
            }}
            class="font-medium text-ink underline decoration-ink-faint underline-offset-[3px] hover:decoration-ink"
          >
            {isLogin ? "Create an account" : "Sign in"}
          </button>
        </p>
      </form>
    </Dialog>
  );
}
