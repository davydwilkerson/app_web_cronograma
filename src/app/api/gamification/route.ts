import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGamificationSnapshot } from "@/lib/gamification";

function parseWeek(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const weekNum = parseWeek(request.nextUrl.searchParams.get("weekNum"));
    const gamification = await getGamificationSnapshot({ userId, currentWeek: weekNum });

    return NextResponse.json({ success: true, gamification });
  } catch (error) {
    console.error("Gamification API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

