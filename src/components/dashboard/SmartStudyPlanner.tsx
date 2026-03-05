"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./SmartStudyPlanner.module.css";

type WeekdayKey =
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";

interface DisciplinePlanInput {
    key: string;
    label: string;
    totalCards: number;
    completedCards: number;
    remainingCards: number;
}

interface SmartStudyPlannerProps {
    disciplines: DisciplinePlanInput[];
    storageKey: string;
}

interface PlannerSettings {
    examDate: string;
    profile: PlannerProfile;
    scoringModel: ScoringModel;
    wrongPenalty: number;
    availabilityMinutes: Record<WeekdayKey, number>;
    weightByDiscipline: Record<string, number>;
}

interface PlannerWeightsSeed {
    key: string;
    remainingCards: number;
}

type PlannerProfile = "leve" | "padrao" | "hardcore";
type ScoringModel =
    | "discipline_weight"
    | "question_value"
    | "weighted_average"
    | "negative_marking";
type KnowledgeLevel = "iniciante" | "intermediario" | "avancado";
type AssistantPace = "conservador" | "equilibrado" | "agressivo";

interface ProfileAssistantState {
    examDate: string;
    concursoNome: string;
    cidadeUf: string;
    weekdayHours: number;
    saturdayHours: number;
    sundayHours: number;
    knowledgeLevel: KnowledgeLevel;
    pace: AssistantPace;
    toughestDiscipline: string;
}

interface QuestionItem {
    id: string;
    disciplineKey: string;
    statement: string;
    options: string[];
    answerIndex: number;
    explanation: string;
}

interface QuizStats {
    answered: number;
    correct: number;
    streak: number;
    bestStreak: number;
}

const PROFILE_CONFIG: Record<
    PlannerProfile,
    {
        label: string;
        weightExponent: number;
        backlogFactor: number;
        urgencyFactor: number;
        riskMultiplier: number;
        description: string;
    }
> = {
    leve: {
        label: "Leve",
        weightExponent: 0.92,
        backlogFactor: 0.86,
        urgencyFactor: 0.9,
        riskMultiplier: 0.82,
        description: "Distribui carga de forma mais suave.",
    },
    padrao: {
        label: "Padrao",
        weightExponent: 1,
        backlogFactor: 1,
        urgencyFactor: 1,
        riskMultiplier: 1,
        description: "Equilibrio entre constancia e prioridade.",
    },
    hardcore: {
        label: "Hardcore",
        weightExponent: 1.2,
        backlogFactor: 1.24,
        urgencyFactor: 1.28,
        riskMultiplier: 1.34,
        description: "Concentracao forte nas materias criticas.",
    },
};

const SCORING_MODEL_CONFIG: Record<
    ScoringModel,
    {
        label: string;
        weightInputLabel: string;
        tableWeightLabel: string;
        formulaText: string;
    }
> = {
    discipline_weight: {
        label: "Peso por Disciplina",
        weightInputLabel: "Peso da Disciplina",
        tableWeightLabel: "Peso",
        formulaText:
            "Nota = acertos por disciplina x peso da disciplina.",
    },
    question_value: {
        label: "Valor por Questao",
        weightInputLabel: "Valor por Questao",
        tableWeightLabel: "Valor",
        formulaText:
            "Nota = quantidade de acertos x valor de cada questao.",
    },
    weighted_average: {
        label: "Media Ponderada",
        weightInputLabel: "Peso da Media",
        tableWeightLabel: "Peso",
        formulaText:
            "Nota final = soma(nota da disciplina x peso) / soma dos pesos.",
    },
    negative_marking: {
        label: "Com Penalidade",
        weightInputLabel: "Valor por Acerto",
        tableWeightLabel: "Valor",
        formulaText:
            "Nota = (certas x valor) - (erradas x penalidade).",
    },
};

const KNOWLEDGE_LEVEL_LABEL: Record<KnowledgeLevel, string> = {
    iniciante: "Iniciante",
    intermediario: "Intermediario",
    avancado: "Avancado",
};

const ASSISTANT_PACE_LABEL: Record<AssistantPace, string> = {
    conservador: "Conservador",
    equilibrado: "Equilibrado",
    agressivo: "Agressivo",
};

const QUESTION_BANK: QuestionItem[] = [
    {
        id: "pt-1",
        disciplineKey: "portugues",
        statement: "Na frase 'Haviam muitas vagas', a forma verbal correta e:",
        options: [
            "Haviam muitas vagas.",
            "Havia muitas vagas.",
            "Houveram muitas vagas.",
            "Haveriam muitas vagas.",
        ],
        answerIndex: 1,
        explanation: "O verbo haver no sentido de existir e impessoal: Havia.",
    },
    {
        id: "pt-2",
        disciplineKey: "portugues",
        statement: "Qual alternativa apresenta regencia correta?",
        options: [
            "Assisti o filme ontem.",
            "Assisti ao filme ontem.",
            "Assisti no filme ontem.",
            "Assisti para o filme ontem.",
        ],
        answerIndex: 1,
        explanation: "No sentido de ver, assistir exige preposicao 'a': assistir ao filme.",
    },
    {
        id: "rlm-1",
        disciplineKey: "rlm",
        statement: "Se 3 enfermeiros fazem 3 relatorios em 3 horas, quantos relatorios 6 enfermeiros fazem em 6 horas, no mesmo ritmo?",
        options: ["6", "9", "12", "24"],
        answerIndex: 2,
        explanation: "Dobrou profissionais e dobrou tempo: 4 vezes o total inicial (3 x 4 = 12).",
    },
    {
        id: "rlm-2",
        disciplineKey: "rlm",
        statement: "Todo fiscal e servidor. Alguns servidores sao enfermeiros. Conclusao valida:",
        options: [
            "Todo enfermeiro e fiscal.",
            "Algum fiscal pode ser enfermeiro.",
            "Nenhum fiscal e enfermeiro.",
            "Todo servidor e fiscal.",
        ],
        answerIndex: 1,
        explanation: "A unica conclusao possivel e de possibilidade: algum fiscal pode ser enfermeiro.",
    },
    {
        id: "esp1-1",
        disciplineKey: "especifica1",
        statement: "Na classificacao de risco, qual objetivo principal?",
        options: [
            "Atender por ordem de chegada.",
            "Priorizar casos mais graves.",
            "Reduzir numero de profissionais.",
            "Encaminhar todos para internacao.",
        ],
        answerIndex: 1,
        explanation: "Classificacao de risco prioriza gravidade e tempo-resposta.",
    },
    {
        id: "esp1-2",
        disciplineKey: "especifica1",
        statement: "Qual acao e fundamental para seguranca do paciente?",
        options: [
            "Ignorar notificacoes de quase erro.",
            "Checar identificacao antes de procedimentos.",
            "Suspender protocolo de higienizacao.",
            "Registrar apenas eventos graves.",
        ],
        answerIndex: 1,
        explanation: "Identificacao correta reduz erros assistenciais.",
    },
    {
        id: "esp2-1",
        disciplineKey: "especifica2",
        statement: "No processo de enfermagem, qual etapa define objetivos e intervencoes?",
        options: ["Coleta de dados", "Diagnostico", "Planejamento", "Avaliacao"],
        answerIndex: 2,
        explanation: "No planejamento sao definidos objetivos e intervencoes.",
    },
    {
        id: "esp2-2",
        disciplineKey: "especifica2",
        statement: "A SAE deve ser aplicada em:",
        options: [
            "Apenas hospitais privados.",
            "Todos os servicos de enfermagem.",
            "Somente UTI.",
            "Somente atencao basica.",
        ],
        answerIndex: 1,
        explanation: "A SAE e obrigatoria em todos os servicos onde ha enfermagem.",
    },
    {
        id: "sus1-1",
        disciplineKey: "sus1",
        statement: "Um dos principios doutrinarios do SUS e:",
        options: ["Privatizacao", "Universalidade", "Seletividade", "Segmentacao"],
        answerIndex: 1,
        explanation: "Universalidade e principio doutrinario do SUS.",
    },
    {
        id: "sus1-2",
        disciplineKey: "sus1",
        statement: "A integralidade no SUS significa:",
        options: [
            "Atendimento so de alta complexidade.",
            "Atencao completa e articulada.",
            "Atendimento apenas de urgencia.",
            "Acesso por renda.",
        ],
        answerIndex: 1,
        explanation: "Integralidade envolve cuidado completo e continuo.",
    },
    {
        id: "sus2-1",
        disciplineKey: "sus2",
        statement: "O controle social no SUS ocorre principalmente por:",
        options: [
            "Conselhos e conferencias de saude.",
            "Somente ministerios.",
            "Somente camara federal.",
            "Apenas ouvidoria privada.",
        ],
        answerIndex: 0,
        explanation: "Conselhos e conferencias viabilizam participacao social.",
    },
    {
        id: "sus2-2",
        disciplineKey: "sus2",
        statement: "A regionalizacao busca:",
        options: [
            "Centralizar tudo em uma cidade.",
            "Organizar rede por territorios.",
            "Reduzir acesso da populacao.",
            "Separar atencao primaria da especializada.",
        ],
        answerIndex: 1,
        explanation: "Regionalizacao organiza fluxos e servicos por territorio.",
    },
];

const WEEKDAY_ORDER: Array<{ key: WeekdayKey; label: string }> = [
    { key: "monday", label: "Segunda" },
    { key: "tuesday", label: "Terca" },
    { key: "wednesday", label: "Quarta" },
    { key: "thursday", label: "Quinta" },
    { key: "friday", label: "Sexta" },
    { key: "saturday", label: "Sabado" },
    { key: "sunday", label: "Domingo" },
];

const JS_DAY_TO_KEY: Record<number, WeekdayKey> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
};

const DEFAULT_AVAILABILITY: Record<WeekdayKey, number> = {
    monday: 120,
    tuesday: 120,
    wednesday: 120,
    thursday: 120,
    friday: 120,
    saturday: 180,
    sunday: 120,
};

function toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function buildDefaultExamDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 120);
    return toDateInputValue(date);
}

function parseDateInput(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

function startOfToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function clampMinutes(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(24 * 60, Math.round(value)));
}

function clampWeight(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1000, Math.round(value * 10) / 10));
}

function formatMinutes(minutes: number): string {
    const safe = Math.max(0, Math.round(minutes));
    const hours = Math.floor(safe / 60);
    const mins = safe % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
}

function formatCards(value: number): string {
    return `${Math.max(0, Math.round(value * 10) / 10).toString().replace(".", ",")} cards`;
}

function percent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

function formatScore(value: number): string {
    return (Math.round(value * 10) / 10).toString().replace(".", ",");
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function emptyWeekdayCount(): Record<WeekdayKey, number> {
    return {
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0,
    };
}

function clampPenalty(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.max(0, Math.min(2, Math.round(value * 10) / 10));
}

function getScoringModel(value: unknown): ScoringModel {
    if (
        value === "discipline_weight" ||
        value === "question_value" ||
        value === "weighted_average" ||
        value === "negative_marking"
    ) {
        return value;
    }
    return "discipline_weight";
}

function computeScorePotential(
    model: ScoringModel,
    weight: number,
    remainingCards: number,
    workloadShare: number,
    completionGap: number,
    wrongPenalty: number
): number {
    const safeWeight = Math.max(0, weight);
    const safeRemaining = Math.max(0, remainingCards);

    if (model === "weighted_average") {
        return safeWeight * (0.7 + workloadShare * 0.3);
    }

    if (model === "negative_marking") {
        return safeRemaining * safeWeight * (1 + completionGap * wrongPenalty);
    }

    return safeRemaining * safeWeight;
}

function normalizeText(value: string): string {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9:;,+\-./\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function parseNumericToken(value: string): number {
    return Number(value.replace(",", "."));
}

function firstNumberByPatterns(text: string, patterns: RegExp[]): number | null {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
            const parsed = parseNumericToken(match[1]);
            if (Number.isFinite(parsed)) {
                return Math.abs(parsed);
            }
        }
    }
    return null;
}

function detectScoringModelFromEdital(text: string): ScoringModel {
    const normalized = normalizeText(text);

    if (
        normalized.includes("errada anula") ||
        normalized.includes("pontuacao negativa") ||
        normalized.includes("penalidade por erro") ||
        /\+\s*1\s*\/\s*-\s*1/.test(normalized)
    ) {
        return "negative_marking";
    }

    if (
        normalized.includes("media ponderada") ||
        (normalized.includes("nota final") && normalized.includes("soma") && normalized.includes("peso"))
    ) {
        return "weighted_average";
    }

    if (
        normalized.includes("cada questao vale") ||
        normalized.includes("valor por questao") ||
        (normalized.includes("questao") && normalized.includes("vale"))
    ) {
        return "question_value";
    }

    return "discipline_weight";
}

function detectPenaltyFromEdital(text: string): number | null {
    const normalized = normalizeText(text);

    if (normalized.includes("anula uma certa") || normalized.includes("errada anula uma certa")) {
        return 1;
    }

    return firstNumberByPatterns(normalized, [
        /penalidade(?: por erro)?\s*[:=]?\s*(-?\d+(?:[.,]\d+)?)/,
        /errada(?:s)?\s*vale(?:m)?\s*(-?\d+(?:[.,]\d+)?)/,
        /erro(?:s)?\s*vale(?:m)?\s*(-?\d+(?:[.,]\d+)?)/,
        /\+\s*1\s*\/\s*-\s*(\d+(?:[.,]\d+)?)/,
    ]);
}

function extractDisciplineValue(line: string, model: ScoringModel): number | null {
    const normalized = normalizeText(line);
    const pesoPatterns = [
        /peso(?: da disciplina| da materia|)?\s*[:=]?\s*(-?\d+(?:[.,]\d+)?)/,
        /p(?:eso)?\s*[:=]\s*(-?\d+(?:[.,]\d+)?)/,
    ];
    const valorPatterns = [
        /cada questao vale\s*(-?\d+(?:[.,]\d+)?)/,
        /valor(?: por questao| da questao|)\s*[:=]?\s*(-?\d+(?:[.,]\d+)?)/,
        /vale\s*(-?\d+(?:[.,]\d+)?)\s*pontos?/,
    ];

    if (model === "weighted_average" || model === "discipline_weight") {
        const parsed = firstNumberByPatterns(normalized, pesoPatterns);
        if (parsed !== null) return parsed;
    }

    if (model === "question_value" || model === "negative_marking") {
        const parsed = firstNumberByPatterns(normalized, [...valorPatterns, ...pesoPatterns]);
        if (parsed !== null) return parsed;
    }

    return firstNumberByPatterns(normalized, [...pesoPatterns, ...valorPatterns]);
}

function buildDisciplineAliases(discipline: DisciplinePlanInput): string[] {
    const aliases = new Set<string>();
    const baseLabel = normalizeText(discipline.label);
    const baseKey = normalizeText(discipline.key.replace(/\d+/g, " "));

    aliases.add(baseLabel);
    aliases.add(baseKey);
    aliases.add(normalizeText(discipline.key));

    if (discipline.key === "portugues") {
        aliases.add("portugues");
        aliases.add("lingua portuguesa");
    }
    if (discipline.key === "rlm") {
        aliases.add("rlm");
        aliases.add("raciocinio logico");
        aliases.add("raciocinio logico matematico");
    }
    if (discipline.key.startsWith("especifica")) {
        aliases.add("especifica");
        aliases.add("especificas");
        aliases.add("especifica de enfermagem");
        aliases.add("enfermagem");
    }
    if (discipline.key.startsWith("sus")) {
        aliases.add("sus");
        aliases.add("saude publica");
    }
    if (discipline.key === "revisao") {
        aliases.add("revisao");
    }
    if (discipline.key === "simulado") {
        aliases.add("simulado");
    }

    return Array.from(aliases).filter((alias) => alias.length > 1);
}

function extractWeightsFromEdital(
    text: string,
    disciplines: DisciplinePlanInput[],
    model: ScoringModel
): Record<string, number> {
    const lines = text
        .replace(/\r/g, "")
        .split(/\n|;/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    const normalizedLines = lines.map((line) => normalizeText(line));
    const extracted: Record<string, number> = {};

    disciplines.forEach((discipline) => {
        const aliases = buildDisciplineAliases(discipline);

        for (let i = 0; i < normalizedLines.length; i += 1) {
            const line = normalizedLines[i];
            const hasAlias = aliases.some((alias) => line.includes(alias));
            if (!hasAlias) continue;

            const parsed = extractDisciplineValue(lines[i], model);
            if (parsed !== null) {
                extracted[discipline.key] = clampWeight(parsed);
                break;
            }
        }
    });

    return extracted;
}

function choosePlannerProfile(level: KnowledgeLevel, pace: AssistantPace): PlannerProfile {
    if (pace === "conservador") return "leve";
    if (pace === "agressivo") return level === "iniciante" ? "padrao" : "hardcore";
    if (level === "avancado") return "hardcore";
    return "padrao";
}

function inferAutoWeight(
    discipline: DisciplinePlanInput,
    maxRemaining: number,
    toughestDiscipline: string,
    knowledgeLevel: KnowledgeLevel,
    concursoNome: string,
    pace: AssistantPace
): number {
    const normalizedConcurso = normalizeText(concursoNome);
    let score = 1 + (discipline.remainingCards / Math.max(1, maxRemaining)) * 4;

    if (discipline.key === toughestDiscipline) {
        score += 2.3;
    }

    if (
        (discipline.key.startsWith("especifica") || discipline.key === "sus1" || discipline.key === "sus2") &&
        (normalizedConcurso.includes("cofen") ||
            normalizedConcurso.includes("enferm") ||
            normalizedConcurso.includes("fiscal"))
    ) {
        score += 1.8;
    }

    if (knowledgeLevel === "iniciante" && (discipline.key === "portugues" || discipline.key === "rlm")) {
        score += 0.9;
    }

    if (knowledgeLevel === "avancado" && discipline.key === "revisao") {
        score += 0.6;
    }

    if (pace === "agressivo") {
        score *= 1.15;
    }
    if (pace === "conservador") {
        score *= 0.9;
    }

    return clampWeight(score);
}

function buildQuestionPool(
    disciplines: DisciplinePlanInput[],
    disciplineFilter: string
): QuestionItem[] {
    const availableKeys = new Set(disciplines.map((discipline) => discipline.key));
    const filtered = QUESTION_BANK.filter(
        (question) =>
            availableKeys.has(question.disciplineKey) &&
            (disciplineFilter === "all" || question.disciplineKey === disciplineFilter)
    );

    if (filtered.length > 0) {
        return filtered;
    }

    if (disciplineFilter !== "all") {
        const selectedDiscipline = disciplines.find((discipline) => discipline.key === disciplineFilter);
        if (selectedDiscipline) {
            return [
                {
                    id: `fallback-${selectedDiscipline.key}`,
                    disciplineKey: selectedDiscipline.key,
                    statement: `Qual e a melhor estrategia para evoluir em ${selectedDiscipline.label}?`,
                    options: [
                        "Estudar sem revisar e sem resolver questoes.",
                        "Seguir plano semanal, revisar e medir acertos.",
                        "Ignorar erros para ganhar velocidade.",
                        "Trocar de materia todo dia sem criterio.",
                    ],
                    answerIndex: 1,
                    explanation:
                        "Melhor resultado vem com plano, revisao ativa e acompanhamento de desempenho.",
                },
            ];
        }
    }

    return [];
}

function getRandomQuestion(pool: QuestionItem[], usedIds: Set<string>): QuestionItem | null {
    if (pool.length === 0) return null;
    const unseen = pool.filter((question) => !usedIds.has(question.id));
    const source = unseen.length > 0 ? unseen : pool;
    const index = Math.floor(Math.random() * source.length);
    return source[index] || null;
}

function formatDeltaMinutes(deltaMinutes: number): string {
    const rounded = Math.round(deltaMinutes);
    if (rounded === 0) return "0 min";
    const sign = rounded > 0 ? "+" : "-";
    return `${sign}${formatMinutes(Math.abs(rounded))}`;
}

function buildDefaultWeightMap(disciplines: PlannerWeightsSeed[]): Record<string, number> {
    return Object.fromEntries(
        disciplines.map((discipline) => [discipline.key, Math.max(1, discipline.remainingCards)])
    );
}

function sanitizeAvailability(input?: Partial<Record<WeekdayKey, number>>): Record<WeekdayKey, number> {
    return Object.fromEntries(
        WEEKDAY_ORDER.map((weekday) => [
            weekday.key,
            clampMinutes(Number(input?.[weekday.key] ?? DEFAULT_AVAILABILITY[weekday.key])),
        ])
    ) as Record<WeekdayKey, number>;
}

function sanitizeWeights(
    disciplines: PlannerWeightsSeed[],
    input?: Record<string, number>
): Record<string, number> {
    return Object.fromEntries(
        disciplines.map((discipline) => [
            discipline.key,
            clampWeight(Number(input?.[discipline.key] ?? Math.max(1, discipline.remainingCards))),
        ])
    );
}

function buildInitialSettings(
    disciplines: PlannerWeightsSeed[],
    storageKey: string
): PlannerSettings {
    const fallback: PlannerSettings = {
        examDate: buildDefaultExamDate(),
        profile: "padrao",
        scoringModel: "discipline_weight",
        wrongPenalty: 1,
        availabilityMinutes: sanitizeAvailability(),
        weightByDiscipline: buildDefaultWeightMap(disciplines),
    };

    if (typeof window === "undefined") {
        return fallback;
    }

    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return fallback;

        const parsed = JSON.parse(raw) as Partial<PlannerSettings>;
        const profile: PlannerProfile =
            parsed.profile === "leve" || parsed.profile === "hardcore"
                ? parsed.profile
                : "padrao";
        const scoringModel = getScoringModel(parsed.scoringModel);
        const wrongPenalty = clampPenalty(Number(parsed.wrongPenalty ?? 1));

        return {
            examDate: typeof parsed.examDate === "string" ? parsed.examDate : fallback.examDate,
            profile,
            scoringModel,
            wrongPenalty,
            availabilityMinutes: sanitizeAvailability(parsed.availabilityMinutes),
            weightByDiscipline: sanitizeWeights(disciplines, parsed.weightByDiscipline),
        };
    } catch {
        return fallback;
    }
}

export default function SmartStudyPlanner({
    disciplines,
    storageKey,
}: SmartStudyPlannerProps) {
    const firstDisciplineKey = disciplines[0]?.key || "";
    const [settings, setSettings] = useState<PlannerSettings>(() =>
        buildInitialSettings(
            disciplines.map((discipline) => ({
                key: discipline.key,
                remainingCards: discipline.remainingCards,
            })),
            storageKey
        )
    );
    const [profileAssistant, setProfileAssistant] = useState<ProfileAssistantState>({
        examDate: settings.examDate,
        concursoNome: "",
        cidadeUf: "",
        weekdayHours: 3,
        saturdayHours: 3,
        sundayHours: 2,
        knowledgeLevel: "intermediario",
        pace: "equilibrado",
        toughestDiscipline: firstDisciplineKey,
    });
    const [profileAssistantResult, setProfileAssistantResult] = useState("");
    const [editalDraft, setEditalDraft] = useState("");
    const [assistantResult, setAssistantResult] = useState("");
    const [rebalanceResult, setRebalanceResult] = useState("");
    const [quizDiscipline, setQuizDiscipline] = useState<string>("all");
    const [quizCurrent, setQuizCurrent] = useState<QuestionItem | null>(null);
    const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null);
    const [quizFeedback, setQuizFeedback] = useState("");
    const [quizUsedIds, setQuizUsedIds] = useState<string[]>([]);
    const [quizStats, setQuizStats] = useState<QuizStats>({
        answered: 0,
        correct: 0,
        streak: 0,
        bestStreak: 0,
    });

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(settings));
    }, [settings, storageKey]);

    const metrics = useMemo(() => {
        const today = startOfToday();
        const examDate = parseDateInput(settings.examDate);
        const weekdayCount = emptyWeekdayCount();
        const nowKey = JS_DAY_TO_KEY[new Date().getDay()];
        const todayAvailableMinutes = clampMinutes(settings.availabilityMinutes[nowKey]);
        const totalRemainingCards = disciplines.reduce(
            (sum, discipline) => sum + discipline.remainingCards,
            0
        );
        const totalCompletedCards = disciplines.reduce(
            (sum, discipline) => sum + discipline.completedCards,
            0
        );
        const totalCards = disciplines.reduce((sum, discipline) => sum + discipline.totalCards, 0);

        if (!examDate || examDate < today) {
            return {
                valid: false,
                daysUntilExam: 0,
                weeksUntilExam: 0,
                urgencyLevel: 0,
                weekdayCount,
                totalAvailableMinutes: 0,
                todayAvailableMinutes: 0,
                studyDaysCount: 0,
                averageWeeklyMinutes: 0,
                averageStudyDayMinutes: 0,
                totalRemainingCards,
                totalCompletedCards,
                totalCards,
            };
        }

        const cursor = new Date(today);
        while (cursor <= examDate) {
            const key = JS_DAY_TO_KEY[cursor.getDay()];
            weekdayCount[key] += 1;
            cursor.setDate(cursor.getDate() + 1);
        }

        const diffMs = examDate.getTime() - today.getTime();
        const daysUntilExam = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
        const weeksUntilExam = Math.max(1, Math.ceil(daysUntilExam / 7));
        const urgencyLevel = clamp01(1 - daysUntilExam / 180);

        const totalAvailableMinutes = WEEKDAY_ORDER.reduce(
            (sum, weekday) =>
                sum +
                clampMinutes(settings.availabilityMinutes[weekday.key]) *
                    weekdayCount[weekday.key],
            0
        );

        const studyDaysCount = WEEKDAY_ORDER.reduce((sum, weekday) => {
            const minute = clampMinutes(settings.availabilityMinutes[weekday.key]);
            return sum + (minute > 0 ? weekdayCount[weekday.key] : 0);
        }, 0);

        const averageWeeklyMinutes =
            weeksUntilExam > 0 ? totalAvailableMinutes / weeksUntilExam : 0;
        const averageStudyDayMinutes =
            studyDaysCount > 0 ? totalAvailableMinutes / studyDaysCount : 0;

        return {
            valid: true,
            daysUntilExam,
            weeksUntilExam,
            urgencyLevel,
            weekdayCount,
            totalAvailableMinutes,
            todayAvailableMinutes,
            studyDaysCount,
            averageWeeklyMinutes,
            averageStudyDayMinutes,
            totalRemainingCards,
            totalCompletedCards,
            totalCards,
        };
    }, [disciplines, settings.examDate, settings.availabilityMinutes]);

    const disciplinePlan = useMemo(() => {
        const profile = PROFILE_CONFIG[settings.profile];
        const scoringModel = settings.scoringModel;
        const wrongPenalty = settings.wrongPenalty;
        const totalRemainingCards = disciplines.reduce(
            (sum, discipline) => sum + discipline.remainingCards,
            0
        );
        const totalWeight = disciplines.reduce(
            (sum, discipline) =>
                sum +
                Math.max(
                    0,
                    Number(
                        settings.weightByDiscipline[discipline.key] ??
                            Math.max(1, discipline.remainingCards)
                    )
                ),
            0
        );

        const rows = disciplines.map((discipline) => {
            const weight = Math.max(
                0,
                Number(
                    settings.weightByDiscipline[discipline.key] ??
                        Math.max(1, discipline.remainingCards)
                )
            );
            const workloadShare =
                totalRemainingCards > 0
                    ? discipline.remainingCards / totalRemainingCards
                    : 0;
            const weightShare = totalWeight > 0 ? weight / totalWeight : 0;
            const completionRatio =
                discipline.totalCards > 0
                    ? discipline.completedCards / discipline.totalCards
                    : 0;
            const completionGap = clamp01(1 - completionRatio);
            const urgencyBoost =
                1 + metrics.urgencyLevel * 0.45 * profile.urgencyFactor;
            const scorePotential = computeScorePotential(
                scoringModel,
                weight,
                discipline.remainingCards,
                workloadShare,
                completionGap,
                wrongPenalty
            );
            const adjustedWeight =
                Math.pow(scorePotential + 1, profile.weightExponent) - 1;
            const backlogBoost = 1 + workloadShare * profile.backlogFactor;
            const penaltyBoost =
                scoringModel === "negative_marking"
                    ? 1 + wrongPenalty * completionGap * 0.22
                    : 1;
            const riskScore = clamp01(
                (completionGap * 0.58 + workloadShare * 0.42) *
                    urgencyBoost *
                    penaltyBoost
            );
            const criticality = weightShare * 0.62 + workloadShare * 0.38;
            const priorityScore =
                discipline.remainingCards > 0
                    ? adjustedWeight *
                      backlogBoost *
                      (1 + riskScore * profile.riskMultiplier) *
                      (1 + criticality * 0.2)
                    : 0;
            const riskBand =
                riskScore >= 0.68
                    ? "alto"
                    : riskScore >= 0.4
                      ? "medio"
                      : "baixo";
            const recommendation =
                riskBand === "alto"
                    ? "Aumentar foco nesta semana"
                    : riskBand === "medio"
                      ? "Manter ritmo com revisao"
                      : "Ritmo estavel";

            return {
                ...discipline,
                weight,
                workloadShare,
                weightShare,
                completionGap,
                riskScore,
                riskBand,
                recommendation,
                scorePotential,
                priorityScore,
            };
        });

        const totalPriority = rows.reduce((sum, row) => sum + row.priorityScore, 0);
        const maxPriority = rows.reduce(
            (max, row) => Math.max(max, row.priorityScore),
            0
        );

        return rows
            .map((row) => {
                const share = totalPriority > 0 ? row.priorityScore / totalPriority : 0;
                const totalMinutesForDiscipline = metrics.totalAvailableMinutes * share;
                const weeklyMinutes =
                    metrics.weeksUntilExam > 0
                        ? totalMinutesForDiscipline / metrics.weeksUntilExam
                        : 0;
                const minutesPerCard =
                    row.remainingCards > 0
                        ? totalMinutesForDiscipline / row.remainingCards
                        : 0;
                const minutesToday = metrics.todayAvailableMinutes * share;
                const cardsPerWeek =
                    metrics.weeksUntilExam > 0
                        ? row.remainingCards / metrics.weeksUntilExam
                        : 0;
                const cardsPerStudyDay =
                    metrics.studyDaysCount > 0
                        ? row.remainingCards / metrics.studyDaysCount
                        : 0;
                const completedPct =
                    row.totalCards > 0 ? row.completedCards / row.totalCards : 0;
                const priorityPct =
                    maxPriority > 0 ? row.priorityScore / maxPriority : 0;

                return {
                    ...row,
                    share,
                    priorityPct,
                    totalMinutesForDiscipline,
                    weeklyMinutes,
                    minutesPerCard,
                    minutesToday,
                    cardsPerWeek,
                    cardsPerStudyDay,
                    completedPct,
                };
            })
            .sort((a, b) => b.totalMinutesForDiscipline - a.totalMinutesForDiscipline);
    }, [
        disciplines,
        metrics,
        settings.profile,
        settings.scoringModel,
        settings.weightByDiscipline,
        settings.wrongPenalty,
    ]);

    const totalWeight = useMemo(
        () =>
            disciplines.reduce(
                (sum, discipline) =>
                    sum +
                    Math.max(
                        0,
                        Number(
                            settings.weightByDiscipline[discipline.key] ??
                                Math.max(1, discipline.remainingCards)
                        )
                    ),
                0
            ),
        [disciplines, settings.weightByDiscipline]
    );

    const activeProfile = PROFILE_CONFIG[settings.profile];
    const activeScoringModel = SCORING_MODEL_CONFIG[settings.scoringModel];
    const disciplineLabelMap = useMemo(
        () =>
            Object.fromEntries(
                disciplines.map((discipline) => [discipline.key, discipline.label])
            ) as Record<string, string>,
        [disciplines]
    );
    const weeklyRebalance = useMemo(() => {
        if (!metrics.valid || metrics.averageWeeklyMinutes <= 0 || disciplinePlan.length === 0) {
            return [] as Array<
                (typeof disciplinePlan)[number] & {
                    rebalanceFactor: number;
                    rebalanceShare: number;
                    rebalanceWeeklyMinutes: number;
                    deltaMinutes: number;
                }
            >;
        }

        const adjustedRows = disciplinePlan.map((row) => {
            const riskBoost = row.riskBand === "alto" ? 1.22 : row.riskBand === "medio" ? 1.1 : 0.92;
            const lagBoost = 1 + row.completionGap * 0.36;
            const urgencyBoost = 1 + metrics.urgencyLevel * (row.riskBand === "alto" ? 0.2 : 0.1);
            const rebalanceFactor = Math.max(0.1, riskBoost * lagBoost * urgencyBoost);
            return {
                ...row,
                rebalanceFactor,
            };
        });

        const adjustedTotal = adjustedRows.reduce(
            (sum, row) => sum + row.share * row.rebalanceFactor,
            0
        );

        return adjustedRows
            .map((row) => {
                const rebalanceShare =
                    adjustedTotal > 0
                        ? (row.share * row.rebalanceFactor) / adjustedTotal
                        : row.share;
                const rebalanceWeeklyMinutes = metrics.averageWeeklyMinutes * rebalanceShare;
                const deltaMinutes = rebalanceWeeklyMinutes - row.weeklyMinutes;
                return {
                    ...row,
                    rebalanceShare,
                    rebalanceWeeklyMinutes,
                    deltaMinutes,
                };
            })
            .sort((a, b) => Math.abs(b.deltaMinutes) - Math.abs(a.deltaMinutes));
    }, [disciplinePlan, metrics]);

    function updateAvailability(weekday: WeekdayKey, value: string) {
        const next = clampMinutes(Number(value || 0));
        setSettings((prev) => ({
            ...prev,
            availabilityMinutes: {
                ...prev.availabilityMinutes,
                [weekday]: next,
            },
        }));
    }

    function updateWeight(disciplineKey: string, value: string) {
        const next = clampWeight(Number(value || 0));
        setSettings((prev) => ({
            ...prev,
            weightByDiscipline: {
                ...prev.weightByDiscipline,
                [disciplineKey]: next,
            },
        }));
    }

    function applyEditalAssistant() {
        const raw = editalDraft.trim();
        if (!raw) {
            setAssistantResult("Cole um trecho do edital para aplicar automaticamente.");
            return;
        }

        const detectedModel = detectScoringModelFromEdital(raw);
        const detectedPenalty = detectPenaltyFromEdital(raw);
        const extractedWeights = extractWeightsFromEdital(raw, disciplines, detectedModel);
        const updatedCount = Object.keys(extractedWeights).length;

        setSettings((prev) => {
            const nextWeights = { ...prev.weightByDiscipline };
            disciplines.forEach((discipline) => {
                const found = extractedWeights[discipline.key];
                if (typeof found === "number" && Number.isFinite(found)) {
                    nextWeights[discipline.key] = clampWeight(found);
                }
            });

            return {
                ...prev,
                scoringModel: detectedModel,
                wrongPenalty:
                    detectedModel === "negative_marking"
                        ? clampPenalty(detectedPenalty ?? prev.wrongPenalty)
                        : prev.wrongPenalty,
                weightByDiscipline: nextWeights,
            };
        });

        const modelLabel = SCORING_MODEL_CONFIG[detectedModel].label;
        const penaltyLabel =
            detectedModel === "negative_marking"
                ? ` | Penalidade: ${formatScore(clampPenalty(detectedPenalty ?? settings.wrongPenalty))}`
                : "";
        setAssistantResult(
            `Assistente aplicado. Modelo detectado: ${modelLabel}. Disciplinas atualizadas: ${updatedCount}/${disciplines.length}${penaltyLabel}.`
        );
    }

    function applyProfileAssistantPlan() {
        if (!profileAssistant.examDate) {
            setProfileAssistantResult("Informe a data da prova no Assistente de Perfil.");
            return;
        }

        const maxRemaining = disciplines.reduce(
            (max, discipline) => Math.max(max, discipline.remainingCards),
            1
        );
        const nextProfile = choosePlannerProfile(
            profileAssistant.knowledgeLevel,
            profileAssistant.pace
        );
        const nextWeights: Record<string, number> = {};

        disciplines.forEach((discipline) => {
            nextWeights[discipline.key] = inferAutoWeight(
                discipline,
                maxRemaining,
                profileAssistant.toughestDiscipline,
                profileAssistant.knowledgeLevel,
                profileAssistant.concursoNome,
                profileAssistant.pace
            );
        });

        const weekdayMinutes = clampMinutes(profileAssistant.weekdayHours * 60);
        const saturdayMinutes = clampMinutes(profileAssistant.saturdayHours * 60);
        const sundayMinutes = clampMinutes(profileAssistant.sundayHours * 60);
        const weeklyTotalMinutes = weekdayMinutes * 5 + saturdayMinutes + sundayMinutes;

        setSettings((prev) => ({
            ...prev,
            examDate: profileAssistant.examDate,
            profile: nextProfile,
            availabilityMinutes: {
                monday: weekdayMinutes,
                tuesday: weekdayMinutes,
                wednesday: weekdayMinutes,
                thursday: weekdayMinutes,
                friday: weekdayMinutes,
                saturday: saturdayMinutes,
                sunday: sundayMinutes,
            },
            weightByDiscipline: nextWeights,
        }));

        const toughestLabel =
            disciplineLabelMap[profileAssistant.toughestDiscipline] ||
            profileAssistant.toughestDiscipline ||
            "Nao informado";
        const concursoInfo = profileAssistant.concursoNome
            ? `${profileAssistant.concursoNome}${profileAssistant.cidadeUf ? ` - ${profileAssistant.cidadeUf}` : ""}`
            : "Concurso informado";

        setProfileAssistantResult(
            `Plano automatico aplicado para ${concursoInfo}. Carga semanal: ${formatMinutes(
                weeklyTotalMinutes
            )}. Perfil: ${PROFILE_CONFIG[nextProfile].label}. Foco principal: ${toughestLabel}.`
        );
    }

    function applyWeeklyRebalance() {
        if (weeklyRebalance.length === 0) {
            setRebalanceResult("Ainda nao ha dados suficientes para rebalancear.");
            return;
        }

        const weightScale = Math.max(12, disciplines.length * 12);
        setSettings((prev) => {
            const nextWeights = { ...prev.weightByDiscipline };
            weeklyRebalance.forEach((row) => {
                nextWeights[row.key] = clampWeight(row.rebalanceShare * weightScale);
            });
            return {
                ...prev,
                weightByDiscipline: nextWeights,
            };
        });

        setRebalanceResult(
            "Rebalanceamento aplicado. Os pesos foram ajustados para priorizar as materias com maior risco nesta semana."
        );
    }

    function startOrNextQuestion(nextFilter = quizDiscipline) {
        const pool = buildQuestionPool(disciplines, nextFilter);
        if (pool.length === 0) {
            setQuizCurrent(null);
            setQuizFeedback("Nao ha questoes disponiveis para este filtro.");
            return;
        }

        const usedSet = new Set(quizUsedIds);
        const question = getRandomQuestion(pool, usedSet);
        if (!question) {
            setQuizCurrent(null);
            setQuizFeedback("Nao foi possivel carregar uma questao.");
            return;
        }

        const unseenCount = pool.filter((item) => !usedSet.has(item.id)).length;
        const nextUsedIds =
            unseenCount > 0 ? [...quizUsedIds, question.id] : [question.id];

        setQuizUsedIds(nextUsedIds);
        setQuizCurrent(question);
        setQuizSelectedOption(null);
        setQuizFeedback("");
    }

    function submitQuizAnswer() {
        if (!quizCurrent) {
            setQuizFeedback("Clique em Iniciar Treino para carregar uma questao.");
            return;
        }
        if (quizSelectedOption === null) {
            setQuizFeedback("Selecione uma alternativa para enviar.");
            return;
        }

        const isCorrect = quizSelectedOption === quizCurrent.answerIndex;
        setQuizStats((prev) => {
            const nextAnswered = prev.answered + 1;
            const nextCorrect = prev.correct + (isCorrect ? 1 : 0);
            const nextStreak = isCorrect ? prev.streak + 1 : 0;
            return {
                answered: nextAnswered,
                correct: nextCorrect,
                streak: nextStreak,
                bestStreak: Math.max(prev.bestStreak, nextStreak),
            };
        });

        setQuizFeedback(
            `${isCorrect ? "Correto" : "Incorreto"}. ${quizCurrent.explanation}`
        );
    }

    return (
        <section className={styles.panel}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Planejador Inteligente</p>
                    <h2>Tempo Ideal por Materia e por Card</h2>
                    <p className={styles.subtitle}>
                        Informe sua prova, sua disponibilidade e os pesos das disciplinas.
                        O cronograma calcula automaticamente sua distribuicao de tempo.
                    </p>
                </div>
            </header>

            <div className={styles.formGrid}>
                <div className={styles.configCard}>
                    <div className={styles.profileAssistantWrap}>
                        <h3>Assistente de Perfil (Perguntas)</h3>
                        <div className={styles.profileAssistantGrid}>
                            <label className={styles.field}>
                                <span>Data da Prova</span>
                                <input
                                    type="date"
                                    value={profileAssistant.examDate}
                                    onChange={(event) =>
                                        setProfileAssistant((prev) => ({
                                            ...prev,
                                            examDate: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className={styles.field}>
                                <span>Concurso/Cargo</span>
                                <input
                                    type="text"
                                    value={profileAssistant.concursoNome}
                                    placeholder="Fiscal do Cofen"
                                    onChange={(event) =>
                                        setProfileAssistant((prev) => ({
                                            ...prev,
                                            concursoNome: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className={styles.field}>
                                <span>Cidade/UF</span>
                                <input
                                    type="text"
                                    value={profileAssistant.cidadeUf}
                                    placeholder="Brasilia/DF"
                                    onChange={(event) =>
                                        setProfileAssistant((prev) => ({
                                            ...prev,
                                            cidadeUf: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className={styles.field}>
                                <span>Horas Seg-Sex</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={12}
                                    step={0.5}
                                    value={profileAssistant.weekdayHours}
                                    onChange={(event) =>
                                        setProfileAssistant((prev) => ({
                                            ...prev,
                                            weekdayHours: Math.max(
                                                0,
                                                Math.min(12, Number(event.target.value || 0))
                                            ),
                                        }))
                                    }
                                />
                            </label>
                            <label className={styles.field}>
                                <span>Horas Sabado</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={12}
                                    step={0.5}
                                    value={profileAssistant.saturdayHours}
                                    onChange={(event) =>
                                        setProfileAssistant((prev) => ({
                                            ...prev,
                                            saturdayHours: Math.max(
                                                0,
                                                Math.min(12, Number(event.target.value || 0))
                                            ),
                                        }))
                                    }
                                />
                            </label>
                            <label className={styles.field}>
                                <span>Horas Domingo</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={12}
                                    step={0.5}
                                    value={profileAssistant.sundayHours}
                                    onChange={(event) =>
                                        setProfileAssistant((prev) => ({
                                            ...prev,
                                            sundayHours: Math.max(
                                                0,
                                                Math.min(12, Number(event.target.value || 0))
                                            ),
                                        }))
                                    }
                                />
                            </label>
                            <label className={styles.field}>
                                <span>Nivel Atual</span>
                                <select
                                    value={profileAssistant.knowledgeLevel}
                                    onChange={(event) =>
                                        setProfileAssistant((prev) => ({
                                            ...prev,
                                            knowledgeLevel: event.target.value as KnowledgeLevel,
                                        }))
                                    }
                                >
                                    {(Object.keys(KNOWLEDGE_LEVEL_LABEL) as KnowledgeLevel[]).map(
                                        (levelKey) => (
                                            <option key={levelKey} value={levelKey}>
                                                {KNOWLEDGE_LEVEL_LABEL[levelKey]}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>
                            <label className={styles.field}>
                                <span>Ritmo Desejado</span>
                                <select
                                    value={profileAssistant.pace}
                                    onChange={(event) =>
                                        setProfileAssistant((prev) => ({
                                            ...prev,
                                            pace: event.target.value as AssistantPace,
                                        }))
                                    }
                                >
                                    {(Object.keys(ASSISTANT_PACE_LABEL) as AssistantPace[]).map(
                                        (paceKey) => (
                                            <option key={paceKey} value={paceKey}>
                                                {ASSISTANT_PACE_LABEL[paceKey]}
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>
                            <label className={styles.field}>
                                <span>Maior Dificuldade</span>
                                <select
                                    value={profileAssistant.toughestDiscipline}
                                    onChange={(event) =>
                                        setProfileAssistant((prev) => ({
                                            ...prev,
                                            toughestDiscipline: event.target.value,
                                        }))
                                    }
                                >
                                    {disciplines.map((discipline) => (
                                        <option key={discipline.key} value={discipline.key}>
                                            {discipline.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className={styles.profileAssistantActions}>
                            <button
                                type="button"
                                className={styles.assistantButton}
                                onClick={applyProfileAssistantPlan}
                            >
                                Gerar Plano Automatico
                            </button>
                        </div>
                        {profileAssistantResult && (
                            <p className={styles.assistantResult}>{profileAssistantResult}</p>
                        )}
                    </div>
                    <label className={styles.field}>
                        <span>Data do Concurso</span>
                        <input
                            type="date"
                            value={settings.examDate}
                            onChange={(event) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    examDate: event.target.value,
                                }))
                            }
                        />
                    </label>
                    <div className={styles.fieldHint}>
                        O calculo considera o periodo de hoje ate a data informada (inclusive).
                    </div>
                    <div className={styles.profileWrap}>
                        <span className={styles.profileLabel}>Perfil de Ritmo</span>
                        <div className={styles.profileSwitch}>
                            {(Object.keys(PROFILE_CONFIG) as PlannerProfile[]).map((profileKey) => (
                                <button
                                    key={profileKey}
                                    type="button"
                                    className={`${styles.profileButton} ${
                                        settings.profile === profileKey ? styles.profileButtonActive : ""
                                    }`}
                                    onClick={() =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            profile: profileKey,
                                        }))
                                    }
                                >
                                    {PROFILE_CONFIG[profileKey].label}
                                </button>
                            ))}
                        </div>
                        <small className={styles.profileDescription}>
                            {activeProfile.description}
                        </small>
                    </div>
                    <div className={styles.modelWrap}>
                        <span className={styles.modelLabel}>Modelo de Pontuacao do Edital</span>
                        <div className={styles.modelSwitch}>
                            {(Object.keys(SCORING_MODEL_CONFIG) as ScoringModel[]).map(
                                (modelKey) => (
                                    <button
                                        key={modelKey}
                                        type="button"
                                        className={`${styles.modelButton} ${
                                            settings.scoringModel === modelKey
                                                ? styles.modelButtonActive
                                                : ""
                                        }`}
                                        onClick={() =>
                                            setSettings((prev) => ({
                                                ...prev,
                                                scoringModel: modelKey,
                                            }))
                                        }
                                    >
                                        {SCORING_MODEL_CONFIG[modelKey].label}
                                    </button>
                                )
                            )}
                        </div>
                        {settings.scoringModel === "negative_marking" && (
                            <label className={styles.inlineField}>
                                <span>Penalidade por Erro</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={2}
                                    step={0.1}
                                    value={settings.wrongPenalty}
                                    onChange={(event) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            wrongPenalty: clampPenalty(
                                                Number(event.target.value)
                                            ),
                                        }))
                                    }
                                />
                            </label>
                        )}
                        <small className={styles.modelFormula}>
                            {activeScoringModel.formulaText}
                        </small>
                    </div>
                    <div className={styles.assistantWrap}>
                        <span className={styles.modelLabel}>Assistente de Edital</span>
                        <textarea
                            className={styles.assistantTextarea}
                            value={editalDraft}
                            onChange={(event) => setEditalDraft(event.target.value)}
                            placeholder="Cole aqui o trecho do edital com pesos/valores por disciplina. Ex: Portugues peso 2; Especificas peso 3; errada anula uma certa."
                        />
                        <div className={styles.assistantActions}>
                            <button
                                type="button"
                                className={styles.assistantButton}
                                onClick={applyEditalAssistant}
                            >
                                Aplicar Assistente
                            </button>
                            <button
                                type="button"
                                className={styles.assistantGhostButton}
                                onClick={() => {
                                    setEditalDraft("");
                                    setAssistantResult("");
                                }}
                            >
                                Limpar
                            </button>
                        </div>
                        {assistantResult && (
                            <p className={styles.assistantResult}>{assistantResult}</p>
                        )}
                    </div>
                </div>

                <div className={styles.configCard}>
                    <h3>Disponibilidade por Dia (min)</h3>
                    <div className={styles.availabilityGrid}>
                        {WEEKDAY_ORDER.map((weekday) => (
                            <label key={weekday.key} className={styles.field}>
                                <span>{weekday.label}</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={1440}
                                    value={settings.availabilityMinutes[weekday.key]}
                                    onChange={(event) =>
                                        updateAvailability(weekday.key, event.target.value)
                                    }
                                />
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {!metrics.valid ? (
                <p className={styles.notice}>
                    Informe uma data de concurso futura para calcular seu plano.
                </p>
            ) : (
                <>
                    <div className={styles.summaryGrid}>
                        <article>
                            <span>Dias Ate a Prova</span>
                            <strong>{metrics.daysUntilExam}</strong>
                        </article>
                        <article>
                            <span>Tempo Total Disponivel</span>
                            <strong>{formatMinutes(metrics.totalAvailableMinutes)}</strong>
                        </article>
                        <article>
                            <span>Meta Semanal Media</span>
                            <strong>{formatMinutes(metrics.averageWeeklyMinutes)}</strong>
                        </article>
                        <article>
                            <span>Cards Restantes</span>
                            <strong>{metrics.totalRemainingCards}</strong>
                        </article>
                        <article>
                            <span>Pressao de Prazo</span>
                            <strong>{percent(metrics.urgencyLevel)}</strong>
                        </article>
                        <article>
                            <span>Tempo Hoje</span>
                            <strong>{formatMinutes(metrics.todayAvailableMinutes)}</strong>
                        </article>
                        <article>
                            <span>Media por Dia de Estudo</span>
                            <strong>{formatMinutes(metrics.averageStudyDayMinutes)}</strong>
                        </article>
                        <article>
                            <span>Cards Ja Concluidos</span>
                            <strong>{metrics.totalCompletedCards}</strong>
                        </article>
                        <article>
                            <span>Total de Cards</span>
                            <strong>{metrics.totalCards}</strong>
                        </article>
                        <article>
                            <span>Modelo</span>
                            <strong>{activeScoringModel.label}</strong>
                        </article>
                    </div>

                    <section className={styles.rebalanceSection}>
                        <header className={styles.sectionHeader}>
                            <h3>Rebalanceamento Semanal</h3>
                            <small>Ajuste inteligente para os proximos 7 dias</small>
                        </header>
                        <div className={styles.rebalanceGrid}>
                            {weeklyRebalance.slice(0, 6).map((row) => (
                                <article key={`reb-${row.key}`} className={styles.rebalanceCard}>
                                    <strong>{row.label}</strong>
                                    <span>
                                        Atual: {formatMinutes(row.weeklyMinutes)}
                                    </span>
                                    <span>
                                        Sugerido: {formatMinutes(row.rebalanceWeeklyMinutes)}
                                    </span>
                                    <span
                                        className={
                                            row.deltaMinutes >= 0
                                                ? styles.deltaPositive
                                                : styles.deltaNegative
                                        }
                                    >
                                        Ajuste: {formatDeltaMinutes(row.deltaMinutes)}
                                    </span>
                                </article>
                            ))}
                        </div>
                        <div className={styles.rebalanceActions}>
                            <button
                                type="button"
                                className={styles.assistantButton}
                                onClick={applyWeeklyRebalance}
                            >
                                Aplicar Rebalanceamento
                            </button>
                        </div>
                        {rebalanceResult && (
                            <p className={styles.assistantResult}>{rebalanceResult}</p>
                        )}
                    </section>

                    <section className={styles.weightsSection}>
                        <header className={styles.sectionHeader}>
                            <h3>{activeScoringModel.weightInputLabel}</h3>
                            <small>
                                Perfil: {activeProfile.label} | Total: {totalWeight}
                            </small>
                        </header>
                        <div className={styles.weightsGrid}>
                            {disciplinePlan.map((row) => (
                                <label key={row.key} className={styles.weightCard}>
                                    <span>{row.label}</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={1000}
                                        step={0.1}
                                        value={row.weight}
                                        onChange={(event) =>
                                            updateWeight(row.key, event.target.value)
                                        }
                                    />
                                    <small>
                                        {row.remainingCards} cards restantes | potencial{" "}
                                        {formatScore(row.scorePotential)}
                                    </small>
                                </label>
                            ))}
                        </div>
                        {totalWeight <= 0 && (
                            <p className={styles.warning}>
                                Defina pesos acima de zero para gerar a distribuicao de tempo.
                            </p>
                        )}
                    </section>

                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Materia</th>
                                    <th>Concluido</th>
                                    <th>Cards</th>
                                    <th>{activeScoringModel.tableWeightLabel}</th>
                                    <th>Potencial</th>
                                    <th>Participacao</th>
                                    <th>Prioridade</th>
                                    <th>Risco</th>
                                    <th>Tempo por Card</th>
                                    <th>Meta Semanal</th>
                                    <th>Cards/Semana</th>
                                    <th>Cards/Dia</th>
                                    <th>Sugestao para Hoje</th>
                                </tr>
                            </thead>
                            <tbody>
                                {disciplinePlan.map((row) => (
                                    <tr key={row.key}>
                                        <td>{row.label}</td>
                                        <td>{percent(row.completedPct)}</td>
                                        <td>{row.remainingCards}</td>
                                        <td className={styles.weightCell}>
                                            <input
                                                type="number"
                                                min={0}
                                                max={1000}
                                                step={0.1}
                                                value={row.weight}
                                                onChange={(event) =>
                                                    updateWeight(row.key, event.target.value)
                                                }
                                            />
                                        </td>
                                        <td>{formatScore(row.scorePotential)}</td>
                                        <td>
                                            <div className={styles.shareCell}>
                                                <span>{percent(row.share)}</span>
                                                <div className={styles.shareTrack}>
                                                    <i
                                                        style={{
                                                            width: `${Math.max(0, Math.min(100, row.share * 100))}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.shareCell}>
                                                <span>{percent(row.priorityPct)}</span>
                                                <div className={styles.shareTrack}>
                                                    <i
                                                        style={{
                                                            width: `${Math.max(0, Math.min(100, row.priorityPct * 100))}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span
                                                className={`${styles.riskBadge} ${
                                                    row.riskBand === "alto"
                                                        ? styles.riskHigh
                                                        : row.riskBand === "medio"
                                                          ? styles.riskMedium
                                                          : styles.riskLow
                                                }`}
                                                title={row.recommendation}
                                            >
                                                {row.riskBand}
                                            </span>
                                        </td>
                                        <td>{formatMinutes(row.minutesPerCard)}</td>
                                        <td>{formatMinutes(row.weeklyMinutes)}</td>
                                        <td>{formatCards(row.cardsPerWeek)}</td>
                                        <td>{formatCards(row.cardsPerStudyDay)}</td>
                                        <td>{formatMinutes(row.minutesToday)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <section className={styles.quizSection}>
                        <header className={styles.sectionHeader}>
                            <h3>Treino por Questoes</h3>
                            <small>
                                Resolvidas: {quizStats.answered} | Acertos: {quizStats.correct} | Streak: {quizStats.streak}
                            </small>
                        </header>
                        <div className={styles.quizControls}>
                            <label className={styles.field}>
                                <span>Filtro da Questao</span>
                                <select
                                    value={quizDiscipline}
                                    onChange={(event) => {
                                        setQuizDiscipline(event.target.value);
                                        setQuizCurrent(null);
                                        setQuizSelectedOption(null);
                                        setQuizFeedback("");
                                        setQuizUsedIds([]);
                                    }}
                                >
                                    <option value="all">Todas as Disciplinas</option>
                                    {disciplines.map((discipline) => (
                                        <option key={discipline.key} value={discipline.key}>
                                            {discipline.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <button
                                type="button"
                                className={styles.assistantButton}
                                onClick={() => startOrNextQuestion()}
                            >
                                {quizCurrent ? "Nova Questao" : "Iniciar Treino"}
                            </button>
                        </div>

                        {quizCurrent && (
                            <article className={styles.quizCard}>
                                <p className={styles.quizMeta}>
                                    {disciplineLabelMap[quizCurrent.disciplineKey] ||
                                        quizCurrent.disciplineKey}
                                </p>
                                <h4>{quizCurrent.statement}</h4>
                                <div className={styles.quizOptions}>
                                    {quizCurrent.options.map((option, index) => {
                                        const selected = quizSelectedOption === index;
                                        return (
                                            <button
                                                key={`${quizCurrent.id}-${index}`}
                                                type="button"
                                                className={`${styles.quizOption} ${
                                                    selected ? styles.quizOptionSelected : ""
                                                }`}
                                                onClick={() => setQuizSelectedOption(index)}
                                            >
                                                <span>{String.fromCharCode(65 + index)}</span>
                                                <strong>{option}</strong>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className={styles.quizActions}>
                                    <button
                                        type="button"
                                        className={styles.assistantButton}
                                        onClick={submitQuizAnswer}
                                    >
                                        Enviar Resposta
                                    </button>
                                    <span className={styles.quizStatChip}>
                                        Melhor streak: {quizStats.bestStreak}
                                    </span>
                                </div>
                            </article>
                        )}
                        {quizFeedback && <p className={styles.quizFeedback}>{quizFeedback}</p>}
                    </section>
                </>
            )}
        </section>
    );
}
