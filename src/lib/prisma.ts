import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

function createMariaDbAdapter() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error("DATABASE_URL is not set");
    }

    const url = new URL(databaseUrl);
    const database = url.pathname.replace(/^\//, "");
    if (!database) {
        throw new Error("DATABASE_URL must include a database name");
    }

    return new PrismaMariaDb({
        host: url.hostname,
        port: url.port ? Number(url.port) : 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database,
        connectionLimit: Number(process.env.DATABASE_CONNECTION_LIMIT || "10"),
    });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter: createMariaDbAdapter(),
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
