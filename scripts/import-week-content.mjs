#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DISCIPLINE_SET = new Set([
    "portugues",
    "especifica1",
    "especifica2",
    "rlm",
    "sus1",
    "sus2",
    "revisao",
    "simulado",
]);

const args = parseArgs(process.argv.slice(2));
const dryRun = hasFlag(args, "dry-run");
const seedOnly = hasFlag(args, "seed-only");
const sourceArg = readArg(args, "source");
const inputArg = readArg(args, "input");
const writeSeedArg = args.get("write-seed");

loadEnv(path.resolve(process.cwd(), ".env"));
loadEnv(path.resolve(process.cwd(), ".env.local"));

main().catch((error) => {
    console.error("ERRO:", error.message);
    process.exitCode = 1;
});

async function main() {
    const sourceDir = sourceArg ? path.resolve(process.cwd(), sourceArg) : "";
    const inputPath = inputArg
        ? path.resolve(process.cwd(), inputArg)
        : path.resolve(process.cwd(), "data", "week-content.seed.json");
    const writeSeedPath =
        typeof writeSeedArg === "string" && writeSeedArg.length > 0
            ? path.resolve(process.cwd(), writeSeedArg)
            : writeSeedArg
              ? path.resolve(process.cwd(), "data", "week-content.seed.json")
              : "";

    let rows = [];
    let sourceLabel = "";

    if (sourceDir) {
        rows = parseLegacyHtml(sourceDir);
        sourceLabel = `legacy-html:${sourceDir}`;
    } else if (fs.existsSync(inputPath)) {
        rows = readSeedJson(inputPath);
        sourceLabel = `seed-json:${inputPath}`;
    } else {
        const autoDir = detectLegacyDir();
        if (!autoDir) {
            throw new Error(
                "Nao encontrei data/week-content.seed.json nem diretorio legado. Use --source=<dir>."
            );
        }
        rows = parseLegacyHtml(autoDir);
        sourceLabel = `legacy-html:${autoDir}`;
    }

    rows = normalizeRows(rows);
    if (rows.length === 0) {
        throw new Error("Nenhum card encontrado para importar.");
    }

    const summary = summarize(rows);
    console.log("Fonte:", sourceLabel);
    console.log(
        `Semanas: ${summary.weeks} | Dias: ${summary.days} | Cards: ${summary.cards}`
    );

    if (writeSeedPath) {
        fs.mkdirSync(path.dirname(writeSeedPath), { recursive: true });
        fs.writeFileSync(writeSeedPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
        console.log("Seed JSON salvo em:", writeSeedPath);
    }

    if (dryRun || seedOnly) {
        console.log("Modo sem escrita no banco ativado.");
        return;
    }

    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL nao encontrado. Ajuste o .env antes de importar.");
    }

    const prisma = new PrismaClient();
    try {
        const weekNums = Array.from(new Set(rows.map((row) => row.weekNum))).sort(
            (a, b) => a - b
        );
        await prisma.weekContent.deleteMany({
            where: {
                weekNum: { in: weekNums },
            },
        });

        for (let i = 0; i < rows.length; i += 100) {
            await prisma.weekContent.createMany({
                data: rows.slice(i, i + 100),
            });
        }

        console.log("Importacao concluida com sucesso.");
    } finally {
        await prisma.$disconnect();
    }
}

function parseArgs(rawArgs) {
    const parsed = new Map();
    for (const arg of rawArgs) {
        if (!arg.startsWith("--")) continue;
        const normalized = arg.slice(2);
        const equalsIndex = normalized.indexOf("=");
        if (equalsIndex < 0) {
            parsed.set(normalized, true);
            continue;
        }
        parsed.set(
            normalized.slice(0, equalsIndex),
            normalized.slice(equalsIndex + 1)
        );
    }
    return parsed;
}

function hasFlag(parsedArgs, name) {
    return parsedArgs.has(name);
}

function readArg(parsedArgs, name) {
    const value = parsedArgs.get(name);
    return typeof value === "string" ? value : "";
}

function loadEnv(filePath) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
        if (!line || line.trimStart().startsWith("#")) continue;
        const separator = line.indexOf("=");
        if (separator < 1) continue;
        const key = line.slice(0, separator).trim();
        if (!key || process.env[key]) continue;
        let value = line.slice(separator + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
}

function detectLegacyDir() {
    const candidates = [
        path.resolve(process.cwd(), "..", "CRON - PRODUCAO"),
        path.resolve(process.cwd(), "..", "CRON - PRODUÇÃO"),
        path.resolve(process.cwd(), "..", "..", "CRON - PRODUCAO"),
        path.resolve(process.cwd(), "..", "..", "CRON - PRODUÇÃO"),
        path.resolve(__dirname, "..", "..", "CRON - PRODUCAO"),
        path.resolve(__dirname, "..", "..", "CRON - PRODUÇÃO"),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
            const hasWeekFile = fs
                .readdirSync(candidate)
                .some((name) => /^ca-s\d+\.html$/i.test(name));
            if (hasWeekFile) return candidate;
        }
    }
    return "";
}

function parseLegacyHtml(sourceDir) {
    if (!fs.existsSync(sourceDir)) {
        throw new Error(`Diretorio nao encontrado: ${sourceDir}`);
    }

    const files = fs
        .readdirSync(sourceDir)
        .map((fileName) => {
            const match = /^ca-s(\d+)\.html$/i.exec(fileName);
            if (!match) return null;
            return {
                fileName,
                weekNum: Number.parseInt(match[1], 10),
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.weekNum - b.weekNum);

    if (files.length === 0) {
        throw new Error(`Nenhum arquivo ca-s*.html encontrado em ${sourceDir}`);
    }

    const rows = [];
    for (const file of files) {
        const fullPath = path.join(sourceDir, file.fileName);
        const html = fs.readFileSync(fullPath, "utf8");
        rows.push(...parseWeekHtml(file.weekNum, html));
    }
    return rows;
}

function parseWeekHtml(weekNum, html) {
    const dayRegex =
        /<section[^>]*class="[^"]*\bday-section\b[^"]*"[^>]*data-day="(\d+)"[^>]*>([\s\S]*?)<\/section>/gi;
    const rows = [];
    const dayMatches = Array.from(html.matchAll(dayRegex));

    for (const dayMatch of dayMatches) {
        const dayNum = Number.parseInt(dayMatch[1], 10);
        if (!Number.isFinite(dayNum)) continue;
        const dayHtml = dayMatch[2];
        const cards = parseCards(dayHtml);

        cards.forEach((card, index) => {
            rows.push({
                weekNum,
                dayNum,
                cardOrder: index + 1,
                cardId: card.cardId,
                discipline: card.discipline,
                title: card.title,
                links: card.links,
                progressItems: card.progressItems,
            });
        });
    }

    if (rows.length > 0) {
        return rows;
    }

    const reviewCards = parseReviewCards(html);
    reviewCards.forEach((card, index) => {
        rows.push({
            weekNum,
            dayNum: 1,
            cardOrder: index + 1,
            cardId: card.cardId,
            discipline: card.discipline,
            title: card.title,
            links: card.links,
            progressItems: card.progressItems,
        });
    });

    return rows;
}

function parseCards(dayHtml) {
    const articleRegex =
        /<article[^>]*class="[^"]*\bstudy-card\b([^"]*)"[^>]*data-id="([^"]+)"[^>]*>([\s\S]*?)<\/article>/gi;
    const cards = [];

    for (const match of dayHtml.matchAll(articleRegex)) {
        const classChunk = match[1] || "";
        const cardId = cleanText(match[2]);
        if (!cardId) continue;

        const classTokens = classChunk
            .split(/\s+/)
            .map((token) => token.trim())
            .filter(Boolean);
        const discipline =
            classTokens.find((token) => DISCIPLINE_SET.has(token)) || "revisao";

        const cardHtml = match[3] || "";
        const title = extractCardTitle(cardHtml) || `Card ${cardId}`;
        const links = extractLinks(cardHtml, "card-links", "card-link");
        const progressItems = extractProgressItems(cardHtml, discipline);

        cards.push({
            cardId,
            discipline,
            title,
            links,
            progressItems,
        });
    }

    return cards;
}

function parseReviewCards(weekHtml) {
    const articleRegex =
        /<article[^>]*class="[^"]*\bmateria-card\b([^"]*)"[^>]*data-id="([^"]+)"[^>]*>([\s\S]*?)<\/article>/gi;
    const cards = [];

    for (const match of weekHtml.matchAll(articleRegex)) {
        const classChunk = match[1] || "";
        const cardId = cleanText(match[2]);
        if (!cardId) continue;

        const classTokens = classChunk
            .split(/\s+/)
            .map((token) => token.trim())
            .filter(Boolean);
        const rawDiscipline =
            classTokens.find(
                (token) => DISCIPLINE_SET.has(token) || token === "revisao-geral"
            ) || "revisao";
        const discipline = rawDiscipline === "revisao-geral" ? "revisao" : rawDiscipline;

        const cardHtml = match[3] || "";
        const title = extractReviewCardTitle(cardHtml) || `Card ${cardId}`;
        const links = extractLinks(cardHtml, "materia-links", "materia-link");
        const progressItems = extractProgressItems(cardHtml, discipline);

        cards.push({
            cardId,
            discipline,
            title,
            links,
            progressItems,
        });
    }

    return cards;
}

function extractCardTitle(cardHtml) {
    const match = cardHtml.match(
        /<h3[^>]*class="[^"]*\bcard-title\b[^"]*"[^>]*>([\s\S]*?)<\/h3>/i
    );
    return cleanText(match?.[1] || "");
}

function extractReviewCardTitle(cardHtml) {
    const match = cardHtml.match(
        /<div[^>]*class="[^"]*\bmateria-card-info\b[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/i
    );
    return cleanText(match?.[1] || "");
}

function extractLinks(cardHtml, containerClassName, itemClassName) {
    const linksMatch = cardHtml.match(
        new RegExp(
            `<div[^>]*class="[^"]*\\b${containerClassName}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`,
            "i"
        )
    );
    if (!linksMatch) return [];

    const links = [];
    const linkRegex = new RegExp(
        `<(a|span)\\b([^>]*)class="[^"]*\\b${itemClassName}\\b[^"]*"([^>]*)>([\\s\\S]*?)<\\/\\1>`,
        "gi"
    );

    for (const linkMatch of linksMatch[1].matchAll(linkRegex)) {
        const tagName = linkMatch[1].toLowerCase();
        const attrs = `${linkMatch[2] || ""} ${linkMatch[3] || ""}`;
        const label = cleanText(linkMatch[4] || "");
        if (!label) continue;

        const hrefMatch = attrs.match(/\shref="([^"]+)"/i);
        const url = tagName === "a" ? cleanText(hrefMatch?.[1] || "") : "";
        const isPrimary = /\bprimary\b/i.test(attrs);
        const type = inferLinkType(label, url, attrs);

        links.push({
            type,
            label,
            url,
            isPrimary,
        });
    }

    return links;
}

function extractProgressItems(cardHtml, discipline) {
    const itemRegex =
        /<div[^>]*class="[^"]*\bprogress-item\b[^"]*"[^>]*data-check="([^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*\bprogress-item-label\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
    const items = [];
    const seen = new Set();

    for (const match of cardHtml.matchAll(itemRegex)) {
        const key = cleanText(match[1] || "").toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const label = cleanText(match[2] || "") || key;
        items.push({ key, label });
    }

    if (items.length > 0) return items;
    if (discipline === "simulado") {
        return [{ key: "simulado", label: "Simulado" }];
    }
    return [
        { key: "teoria", label: "Teoria" },
        { key: "revisao", label: "Revisao imediata" },
        { key: "exercicios", label: "Exercicios" },
        { key: "ativo", label: "Ativo de aprendizagem" },
    ];
}

function inferLinkType(label, url, attrs) {
    const normalized = `${label} ${url} ${attrs}`.toLowerCase();
    if (
        normalized.includes("youtube") ||
        normalized.includes("video") ||
        normalized.includes("teoria")
    ) {
        return "video";
    }
    if (normalized.includes("pdf") || normalized.includes(".pdf")) {
        return "pdf";
    }
    if (normalized.includes("exercicio")) {
        return "exercise";
    }
    if (normalized.includes("simulado") || normalized.includes("prova")) {
        return "exam";
    }
    if (normalized.includes("lei")) {
        return "law";
    }
    if (normalized.includes("material")) {
        return "material";
    }
    return "info";
}

function readSeedJson(filePath) {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
        throw new Error(`Seed invalido em ${filePath}`);
    }
    return parsed;
}

function normalizeRows(rows) {
    return rows
        .map((row) => {
            const weekNum = toPositiveInt(row.weekNum);
            const dayNum = toPositiveInt(row.dayNum);
            const cardOrder = toPositiveInt(row.cardOrder);
            const cardId = cleanText(row.cardId);
            const discipline = DISCIPLINE_SET.has(row.discipline)
                ? row.discipline
                : "revisao";
            const title = cleanText(row.title);
            const links = Array.isArray(row.links) ? row.links : [];
            const progressItems = Array.isArray(row.progressItems)
                ? row.progressItems
                : [];

            if (!weekNum || !dayNum || !cardOrder || !cardId || !title) {
                return null;
            }

            return {
                weekNum,
                dayNum,
                cardOrder,
                cardId,
                discipline,
                title,
                links: links
                    .map((link) => ({
                        type:
                            link.type === "video" ||
                            link.type === "pdf" ||
                            link.type === "exercise" ||
                            link.type === "exam" ||
                            link.type === "material" ||
                            link.type === "law"
                                ? link.type
                                : "info",
                        label: cleanText(link.label),
                        url: cleanText(link.url || ""),
                        isPrimary: Boolean(link.isPrimary),
                    }))
                    .filter((link) => link.label),
                progressItems: progressItems
                    .map((item) => ({
                        key: cleanText(item.key).toLowerCase(),
                        label: cleanText(item.label),
                    }))
                    .filter((item) => item.key && item.label),
            };
        })
        .filter(Boolean);
}

function summarize(rows) {
    const weekSet = new Set();
    const daySet = new Set();

    for (const row of rows) {
        weekSet.add(row.weekNum);
        daySet.add(`${row.weekNum}-${row.dayNum}`);
    }

    return {
        weeks: weekSet.size,
        days: daySet.size,
        cards: rows.length,
    };
}

function toPositiveInt(value) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function cleanText(value) {
    const decoded = decodeHtmlEntities(stripTags(String(value || "")));
    return normalizeMojibake(decoded)
        .replace(/\s+/g, " ")
        .trim();
}

function stripTags(value) {
    return value
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(value) {
    const named = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: " ",
        aacute: "á",
        Aacute: "Á",
        agrave: "à",
        Agrave: "À",
        acirc: "â",
        Acirc: "Â",
        atilde: "ã",
        Atilde: "Ã",
        eacute: "é",
        Eacute: "É",
        ecirc: "ê",
        Ecirc: "Ê",
        iacute: "í",
        Iacute: "Í",
        oacute: "ó",
        Oacute: "Ó",
        ocirc: "ô",
        Ocirc: "Ô",
        otilde: "õ",
        Otilde: "Õ",
        uacute: "ú",
        Uacute: "Ú",
        ccedil: "ç",
        Ccedil: "Ç",
        ordm: "º",
        ordf: "ª",
        rsquo: "'",
        lsquo: "'",
        ldquo: '"',
        rdquo: '"',
        ndash: "-",
        mdash: "-",
        hellip: "...",
    };

    return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, entity) => {
        if (entity.startsWith("#x") || entity.startsWith("#X")) {
            const codePoint = Number.parseInt(entity.slice(2), 16);
            return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : full;
        }
        if (entity.startsWith("#")) {
            const codePoint = Number.parseInt(entity.slice(1), 10);
            return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : full;
        }
        return named[entity] || full;
    });
}

function normalizeMojibake(value) {
    if (!/[ÃÂ]/.test(value)) {
        return value;
    }

    const repaired = Buffer.from(value, "latin1").toString("utf8");
    const originalNoise = (value.match(/[ÃÂ]/g) || []).length;
    const repairedNoise = (repaired.match(/[ÃÂ]/g) || []).length;

    return repairedNoise < originalNoise ? repaired : value;
}
