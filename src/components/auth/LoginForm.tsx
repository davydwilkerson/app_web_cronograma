"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./LoginForm.module.css";

interface LoginFormProps {
    redirectTo: string;
}

type FormMode = "login" | "recovery" | "first-access";

export default function LoginForm({ redirectTo }: LoginFormProps) {
    const [mode, setMode] = useState<FormMode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{
        message: string;
        tone: "info" | "warn" | "error";
    } | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();

    async function handleGoogleLogin() {
        setLoading(true);
        await signIn("google", { callbackUrl: redirectTo });
    }

    async function handleEmailLogin(e: FormEvent) {
        e.preventDefault();
        setLoading(true);
        setFeedback(null);

        const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        if (result?.error) {
            setFeedback({
                message: "E-mail ou senha incorretos.",
                tone: "error",
            });
            setLoading(false);
        } else {
            router.push(redirectTo);
        }
    }

    async function handleRecovery(e: FormEvent) {
        e.preventDefault();
        setFeedback({
            message: "Funcionalidade de recuperação será configurada em breve.",
            tone: "info",
        });
    }

    async function handleFirstAccess(e: FormEvent) {
        e.preventDefault();
        setFeedback({
            message: "Para criar conta, entre em contato com o suporte ou use o Google Login.",
            tone: "warn",
        });
    }

    return (
        <div className={styles.formContainer}>
            <button
                type="button"
                className={styles.googleBtn}
                onClick={handleGoogleLogin}
                disabled={loading}
            >
                <svg viewBox="0 0 24 24" width="20" height="20">
                    <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    />
                    <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                </svg>
                <span>Entrar com Google</span>
            </button>

            <div className={styles.divider}>
                <span>ou</span>
            </div>

            <form
                onSubmit={
                    mode === "login"
                        ? handleEmailLogin
                        : mode === "recovery"
                          ? handleRecovery
                          : handleFirstAccess
                }
                className={styles.form}
            >
                <div className={styles.inputGroup}>
                    <label htmlFor="email-input" className={styles.label}>
                        E-mail
                    </label>
                    <input
                        type="email"
                        id="email-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className={styles.input}
                        required
                        disabled={loading}
                    />
                </div>

                {mode !== "recovery" && (
                    <div className={styles.inputGroup}>
                        <label htmlFor="password-input" className={styles.label}>
                            Senha
                        </label>
                        <div className={styles.passwordWrap}>
                            <input
                                type={showPassword ? "text" : "password"}
                                id="password-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Sua senha"
                                className={styles.input}
                                required
                                disabled={loading}
                            />
                            <button
                                type="button"
                                className={styles.eyeBtn}
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                            </button>
                        </div>
                    </div>
                )}

                {feedback && (
                    <div
                        className={`${styles.feedback} ${
                            feedback.tone === "error"
                                ? styles.feedbackError
                                : feedback.tone === "warn"
                                  ? styles.feedbackWarn
                                  : styles.feedbackInfo
                        }`}
                    >
                        {feedback.message}
                    </div>
                )}

                <button type="submit" className={styles.submitBtn} disabled={loading}>
                    {loading ? (
                        <span className="spinner" />
                    ) : mode === "login" ? (
                        <>
                            <i className="fas fa-sign-in-alt"></i> Entrar
                        </>
                    ) : mode === "recovery" ? (
                        <>
                            <i className="fas fa-paper-plane"></i> Enviar link
                        </>
                    ) : (
                        <>
                            <i className="fas fa-user-plus"></i> Criar conta
                        </>
                    )}
                </button>
            </form>

            <div className={styles.modeLinks}>
                {mode === "login" && (
                    <button
                        type="button"
                        className={styles.modeLink}
                        onClick={() => {
                            setMode("recovery");
                            setFeedback(null);
                        }}
                    >
                        Esqueci minha senha
                    </button>
                )}

                {(mode === "recovery" || mode === "first-access") && (
                    <button
                        type="button"
                        className={styles.modeLink}
                        onClick={() => {
                            setMode("login");
                            setFeedback(null);
                        }}
                    >
                        ← Voltar ao Login
                    </button>
                )}
            </div>
        </div>
    );
}

