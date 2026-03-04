"use client";

import styles from "./TrialBanner.module.css";

interface TrialBannerProps {
    expiresAtLabel: string;
}

export default function TrialBanner({ expiresAtLabel }: TrialBannerProps) {
    return (
        <div className={styles.banner}>
            <div className={styles.content}>
                <i className="fas fa-clock"></i>
                <div>
                    <strong>Período de Teste</strong> - Você tem acesso à Semana 1 até{" "}
                    <strong>{expiresAtLabel || "o fim do período de teste"}</strong>.
                </div>
            </div>
            <a
                href="https://enfermeiroaprovado.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.upgradeBtn}
            >
                <i className="fas fa-crown"></i>
                Assinar agora
            </a>
        </div>
    );
}
