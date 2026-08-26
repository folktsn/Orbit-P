import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type LineMappingsCache = {
  mappings: Record<string, string> | null;
  expiresAt: number;
};

type LineConnection = {
  staffId: string;
  lineAvatar: string | null;
};

const CACHE_TTL_MS = 60_000;
const GLOBAL_CACHE_KEY = "__s_recruit_line_mappings_cache__";
const globalWithCache = globalThis as typeof globalThis & {
  [GLOBAL_CACHE_KEY]?: LineMappingsCache;
};

function getCache(): LineMappingsCache {
  if (!globalWithCache[GLOBAL_CACHE_KEY]) {
    globalWithCache[GLOBAL_CACHE_KEY] = { mappings: null, expiresAt: 0 };
  }

  return globalWithCache[GLOBAL_CACHE_KEY];
}

export async function GET() {
  try {
    const cache = getCache();
    if (cache.mappings && Date.now() < cache.expiresAt) {
      return NextResponse.json(
        { success: true, mappings: cache.mappings },
        {
          headers: {
            "Cache-Control": "private, max-age=60",
            "X-Line-Mappings-Cache": "HIT",
          },
        }
      );
    }

    const connections = await prisma.lineWebhook.findMany({
      where: { status: "Linked" },
      select: { staffId: true, lineAvatar: true },
    });

    // Reduce into a fast lookup key-value map: { [staffId]: lineAvatarUrl }
    const mappingMap = (connections as LineConnection[]).reduce((acc, curr) => {
      if (curr.staffId && curr.lineAvatar) {
        acc[curr.staffId] = curr.lineAvatar;
      }
      return acc;
    }, {} as Record<string, string>);

    cache.mappings = mappingMap;
    cache.expiresAt = Date.now() + CACHE_TTL_MS;

    return NextResponse.json(
      { success: true, mappings: mappingMap },
      {
        headers: {
          "Cache-Control": "private, max-age=60",
          "X-Line-Mappings-Cache": "MISS",
        },
      }
    );
  } catch (error: any) {
    console.error("Error fetching LINE avatar mappings:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
