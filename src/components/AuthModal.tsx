// Sign-in / create-account / password-reset dialog for paper trading and watchlist sync.
import type { ComponentChildren, JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { store } from "../state";
import { supabase } from "../services/supabase";
import { Dialog, DialogHeader } from "./Dialog";
import { btn, input, size } from "./ui";

type AuthMode = "login" | "signup" | "forgot" | "reset";

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function AuthModal() {
  if (!store.isAuthModalOpen.value) return null;
  return <AuthDialog />;
}

function Field({
  id,
  label,
  labelExtra,
  hint,
  ...inputProps
}: { id: string; label: string; labelExtra?: ComponentChildren; hint?: string } & JSX.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div class="space-y-1.5">
      <div class="flex items-baseline justify-between gap-2">
        <label for={id} class="block text-sm font-medium text-ink-soft">
          {label}
        </label>
        {labelExtra}
      </div>
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
  const [mode, setMode] = useState<AuthMode>(() =>
    store.isPasswordRecovery.value ? "reset" : "login"
  );
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resetEmailSent, setResetEmailSent] = useState(false);

  useEffect(() => {
    if (store.isPasswordRecovery.value) {
      setMode("reset");
      setErrorMsg("");
      setResetEmailSent(false);
    }
  }, [store.isPasswordRecovery.value]);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setErrorMsg("");
    setResetEmailSent(false);
  };

  const close = () => {
    store.isAuthModalOpen.value = false;
    store.authModalIntent.value = null;
    store.isPasswordRecovery.value = false;
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
      if (mode === "forgot") {
        const cleanEmail = email.trim();
        if (!isValidEmail(cleanEmail)) {
          throw new Error("Enter a valid email address, like name@example.com.");
        }
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setResetEmailSent(true);
        return;
      }

      if (mode === "reset") {
        if (password.length < 6) throw new Error("Passwords need at least 6 characters.");
        if (password !== confirmPassword) throw new Error("The two passwords don’t match.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
        store.showToast("Your password has been updated.");
        handleAuthSuccess();
        return;
      }

      if (!isValidEmail(email)) throw new Error("Enter a valid email address, like name@example.com.");

      if (mode === "login") {
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

  const title =
    mode === "login"
      ? "Sign in"
      : mode === "signup"
        ? "Create an account"
        : mode === "forgot"
          ? "Reset your password"
          : "Choose a new password";

  const description =
    mode === "forgot"
      ? "Enter your account email and we’ll send you a link to set a new password."
      : mode === "reset"
        ? "Enter a new password for your TrackMarket account."
        : intentCopy;

  return (
    <Dialog onClose={close} labelledBy="auth-title" width="max-w-sm">
      <DialogHeader id="auth-title" title={title} description={description} onClose={close} />

      {mode === "forgot" && resetEmailSent ? (
        <div class="space-y-4 px-5 py-5">
          <p class="text-sm text-ink-soft">
            If an account exists for <span class="font-medium text-ink">{email.trim()}</span>, a password
            reset link is on its way. Check your inbox and spam folder.
          </p>
          <button
            type="button"
            onClick={() => switchMode("login")}
            class={`${btn.secondary} ${size.lg} w-full`}
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} class="space-y-4 px-5 py-5" noValidate>
          {mode === "signup" && (
            <Field
              id="auth-username"
              label="Username"
              hint="Letters, numbers and underscores, at least 3 characters."
              type="text"
              autocomplete="username"
              required
              data-autofocus
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
            />
          )}

          {(mode === "login" || mode === "signup" || mode === "forgot") && (
            <Field
              id="auth-email"
              label="Email"
              type="email"
              autocomplete="email"
              required
              data-autofocus={mode !== "signup"}
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            />
          )}

          {(mode === "login" || mode === "signup" || mode === "reset") && (
            <Field
              id="auth-password"
              label={mode === "reset" ? "New password" : "Password"}
              labelExtra={
                mode === "login" ? (
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    class="text-xs text-ink-muted underline decoration-ink-faint underline-offset-[3px] hover:text-ink hover:decoration-ink"
                  >
                    Forgot password?
                  </button>
                ) : undefined
              }
              hint={mode === "login" ? undefined : "At least 6 characters."}
              type="password"
              autocomplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
              data-autofocus={mode === "reset"}
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            />
          )}

          {(mode === "signup" || mode === "reset") && (
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
            {loading
              ? mode === "login"
                ? "Signing in…"
                : mode === "signup"
                  ? "Creating account…"
                  : mode === "forgot"
                    ? "Sending link…"
                    : "Saving password…"
              : mode === "login"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Save new password"}
          </button>

          {mode !== "reset" && (
            <p class="text-center text-sm text-ink-muted">
              {mode === "login"
                ? "New here? "
                : mode === "signup"
                  ? "Already have an account? "
                  : "Remembered your password? "}
              <button
                type="button"
                onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                class="font-medium text-ink underline decoration-ink-faint underline-offset-[3px] hover:decoration-ink"
              >
                {mode === "login" ? "Create an account" : "Sign in"}
              </button>
            </p>
          )}
        </form>
      )}
    </Dialog>
  );
}
