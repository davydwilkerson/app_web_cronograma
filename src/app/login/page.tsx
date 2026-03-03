import LoginForm from "@/components/auth/LoginForm";
import { getAuthUser } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import styles from "./login.module.css";

export const metadata = {
    title: "Login — Cronograma Enfermeiro Aprovado",
    description: "Faça login para acessar seu cronograma de estudos.",
};

interface LoginPageProps {
    searchParams: Promise<{
        error?: string;
        reason?: string;
        redirect?: string;
        message?: string;
    }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    // Se já estiver logado, redirecionar para dashboard
    const user = await getAuthUser();
    if (user) {
        redirect("/dashboard");
    }

    const params = await searchParams;

    // Resolver mensagem de erro se houver
    let errorMessage = "";
    if (params.error === "no_access") {
        errorMessage =
            "Não encontramos acesso ativo para este e-mail. Verifique se está usando o mesmo e-mail da compra.";
    } else if (params.error === "blocked") {
        errorMessage =
            params.reason === "payment"
                ? "Seu acesso está bloqueado por falta de pagamento."
                : "Seu acesso está temporariamente bloqueado.";
    } else if (params.error === "no_email") {
        errorMessage =
            "Não foi possível obter seu e-mail. Tente novamente com outra conta.";
    } else if (params.error === "session_expired") {
        errorMessage = "Sua sessão expirou. Faça login novamente.";
    } else if (params.error === "device_conflict") {
        errorMessage =
            "Seu acesso foi encerrado porque outra sessão foi iniciada em outro dispositivo.";
    }

    const successMessage = params.message || "";
    const redirectTo = params.redirect || "/dashboard";

    return (
        <div className={styles.loginPage}>
            <div className={styles.loginContainer}>
                {/* Logo e Título */}
                <div className={styles.logoSection}>
                    <h1 className={styles.title}>
                        Cronograma <span>Enfermeiro Aprovado</span>
                    </h1>
                    <p className={styles.subtitle}>
                        Seu plano de estudos estratégico por semana
                    </p>
                </div>

                {/* Mensagens de feedback */}
                {errorMessage && (
                    <div className={styles.feedbackError}>
                        <i className="fas fa-exclamation-triangle"></i>
                        <span>{errorMessage}</span>
                    </div>
                )}

                {successMessage && (
                    <div className={styles.feedbackSuccess}>
                        <i className="fas fa-check-circle"></i>
                        <span>{successMessage}</span>
                    </div>
                )}

                {/* Formulário de Login */}
                <LoginForm redirectTo={redirectTo} />

                {/* Footer */}
                <div className={styles.footerLinks}>
                    <p className={styles.trialLink}>
                        Ainda não comprou?{" "}
                        <a href="/trial" className={styles.link}>
                            Teste grátis por 7 dias →
                        </a>
                    </p>
                    <p className={styles.disclaimer}>
                        © {new Date().getFullYear()} Enfermeiro Aprovado. Todos os direitos
                        reservados.
                    </p>
                </div>
            </div>

            {/* WhatsApp Float */}
            <div className="whatsapp-float-wrap">
                <a
                    href="https://wa.me/5561992599325"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whatsapp-float"
                    title="Suporte via WhatsApp"
                >
                    <svg viewBox="0 0 32 32">
                        <path d="M16.002 3.003c-7.18 0-12.999 5.819-12.999 12.999 0 2.291.598 4.529 1.736 6.505l-1.736 6.49 6.663-1.702a12.937 12.937 0 0 0 6.336 1.642h.006c7.174 0 12.993-5.819 12.993-12.993S23.177 3.003 16.002 3.003zm0 23.764c-1.94 0-3.843-.522-5.498-1.506l-.394-.234-4.087 1.043 1.091-3.981-.257-.41a10.747 10.747 0 0 1-1.651-5.677c0-5.952 4.842-10.794 10.801-10.794 5.952 0 10.788 4.841 10.788 10.794 0 5.959-4.842 10.794-10.794 10.794l.001-.029zm5.927-8.085c-.325-.163-1.919-.948-2.217-1.056-.298-.109-.514-.163-.731.163-.217.326-.838 1.056-1.029 1.273-.19.217-.38.244-.704.081-.325-.163-1.371-.505-2.612-1.611-.966-.86-1.618-1.924-1.808-2.249-.19-.325-.02-.501.143-.663.146-.146.325-.38.488-.57.163-.19.217-.325.325-.542.109-.217.054-.407-.027-.57-.081-.163-.73-1.764-.999-2.413-.271-.651-.54-.557-.731-.568-.19-.011-.407-.013-.624-.013-.217 0-.57.081-.868.407-.298.325-1.137 1.11-1.137 2.707s1.164 3.14 1.325 3.357c.163.217 2.293 3.501 5.554 4.909.776.335 1.381.535 1.854.685.779.247 1.488.212 2.048.129.625-.093 1.919-.784 2.19-1.542.271-.757.271-1.407.19-1.542-.082-.136-.298-.217-.624-.38z" />
                    </svg>
                </a>
            </div>
        </div>
    );
}
