"use client";

import { useEffect } from "react";

/**
 * 🔒 Componente Anti-Cópia
 *
 * Adiciona múltiplas camadas de proteção contra cópia de conteúdo:
 * 1. Bloqueio de Ctrl+C, Ctrl+A, Ctrl+P, Ctrl+S
 * 2. Bloqueio de clique direito no conteúdo
 * 3. Detecção de DevTools aberto
 * 4. Bloqueio de seleção de texto
 * 5. Bloqueio de arrastar texto/imagens
 *
 * Props:
 * - userEmail: email do usuário logado (para marca d'água)
 * - enabled: habilita/desabilita as proteções (default: true)
 */

interface AntiCopyProps {
    userEmail?: string;
    enabled?: boolean;
}

export default function AntiCopy({
    userEmail = "",
    enabled = true,
}: AntiCopyProps) {
    useEffect(() => {
        if (!enabled) return;

        // ── 1. Bloqueio de atalhos de teclado ──
        function handleKeydown(e: KeyboardEvent) {
            // Ctrl+C (copy)
            if (e.ctrlKey && e.key === "c") {
                e.preventDefault();
                return false;
            }
            // Ctrl+A (select all)
            if (e.ctrlKey && e.key === "a") {
                e.preventDefault();
                return false;
            }
            // Ctrl+P (print)
            if (e.ctrlKey && e.key === "p") {
                e.preventDefault();
                return false;
            }
            // Ctrl+S (save)
            if (e.ctrlKey && e.key === "s") {
                e.preventDefault();
                return false;
            }
            // Ctrl+U (view source)
            if (e.ctrlKey && e.key === "u") {
                e.preventDefault();
                return false;
            }
            // Ctrl+Shift+I (DevTools)
            if (e.ctrlKey && e.shiftKey && e.key === "I") {
                e.preventDefault();
                return false;
            }
            // Ctrl+Shift+J (Console)
            if (e.ctrlKey && e.shiftKey && e.key === "J") {
                e.preventDefault();
                return false;
            }
            // Ctrl+Shift+C (Inspect Element)
            if (e.ctrlKey && e.shiftKey && e.key === "C") {
                e.preventDefault();
                return false;
            }
            // F12 (DevTools)
            if (e.key === "F12") {
                e.preventDefault();
                return false;
            }
            // PrintScreen
            if (e.key === "PrintScreen") {
                e.preventDefault();
                // Limpar clipboard
                navigator.clipboard?.writeText?.("").catch(() => { });
                return false;
            }
        }

        // ── 2. Bloqueio de clique direito ──
        function handleContextMenu(e: MouseEvent) {
            const target = e.target as HTMLElement;
            // Permite clique direito em inputs e textareas
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable
            ) {
                return true;
            }
            e.preventDefault();
            return false;
        }

        // ── 3. Bloqueio de cópia ──
        function handleCopy(e: ClipboardEvent) {
            e.preventDefault();
            e.clipboardData?.setData(
                "text/plain",
                "© Conteúdo protegido — Cronograma Enfermeiro Aprovado"
            );
            return false;
        }

        // ── 4. Bloqueio de arrastar ──
        function handleDragStart(e: DragEvent) {
            e.preventDefault();
            return false;
        }

        // ── 5. Bloqueio de seleção de texto ──
        function handleSelectStart(e: Event) {
            const target = e.target as HTMLElement;
            // Permite seleção em inputs e textareas
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable
            ) {
                return true;
            }
            e.preventDefault();
            return false;
        }

        // Adicionar listeners
        document.addEventListener("keydown", handleKeydown, true);
        document.addEventListener("contextmenu", handleContextMenu, true);
        document.addEventListener("copy", handleCopy, true);
        document.addEventListener("dragstart", handleDragStart, true);
        document.addEventListener("selectstart", handleSelectStart, true);

        // Cleanup
        return () => {
            document.removeEventListener("keydown", handleKeydown, true);
            document.removeEventListener("contextmenu", handleContextMenu, true);
            document.removeEventListener("copy", handleCopy, true);
            document.removeEventListener("dragstart", handleDragStart, true);
            document.removeEventListener("selectstart", handleSelectStart, true);
        };
    }, [enabled]);

    if (!enabled) return null;

    return (
        <>
            {/* CSS anti-print e anti-seleção */}
            <style jsx global>{`
        /* Previne seleção de texto no conteúdo protegido */
        .protected-content {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }

        /* Permite seleção em inputs */
        .protected-content input,
        .protected-content textarea,
        .protected-content [contenteditable="true"] {
          -webkit-user-select: auto;
          -moz-user-select: auto;
          -ms-user-select: auto;
          user-select: auto;
        }

        /* Esconde conteúdo ao imprimir */
        @media print {
          body * {
            visibility: hidden !important;
          }
          body::after {
            content: "© Conteúdo protegido por direitos autorais — Cronograma Enfermeiro Aprovado. Impressão não autorizada.";
            visibility: visible !important;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 18px;
            text-align: center;
            color: #333;
            max-width: 80%;
          }
        }

        /* Previne arrastar imagens */
        img {
          -webkit-user-drag: none;
          user-drag: none;
          pointer-events: auto;
        }
      `}</style>

            {/* Marca d'água invisível com email do usuário */}
            {userEmail && (
                <div
                    aria-hidden="true"
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        pointerEvents: "none",
                        zIndex: 9999,
                        opacity: 0.015,
                        fontSize: "14px",
                        fontFamily: "monospace",
                        color: "#000",
                        lineHeight: "3",
                        wordBreak: "break-all",
                        overflow: "hidden",
                        transform: "rotate(-30deg)",
                        transformOrigin: "center center",
                        userSelect: "none",
                        padding: "20px",
                    }}
                >
                    {Array.from({ length: 50 }, (_, i) => (
                        <span key={i}>
                            {userEmail} &nbsp;&nbsp;&nbsp; {userEmail}{" "}
                            &nbsp;&nbsp;&nbsp;{" "}
                        </span>
                    ))}
                </div>
            )}
        </>
    );
}
