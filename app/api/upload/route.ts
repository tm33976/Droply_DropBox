import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Guard: ensure Content-Type is JSON
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415 }
      );
    }

    let body: { imagekit?: Record<string, unknown>; userId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { imagekit, userId: bodyUserId } = body;

    if (bodyUserId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!imagekit || typeof imagekit.url !== "string") {
      return NextResponse.json(
        { error: "Invalid file upload data — missing imagekit.url" },
        { status: 400 }
      );
    }

    const fileData = {
      name: (imagekit.name as string) || "Untitled",
      path:
        (imagekit.filePath as string) ||
        `/droply/${userId}/${imagekit.name as string}`,
      size: (imagekit.size as number) || 0,
      // Normalize type — avoid schema enum mismatches
      type: (imagekit.fileType as string)?.toLowerCase() || "image",
      fileUrl: imagekit.url as string,
      // Use undefined instead of null if your schema requires it
      thumbnailUrl: (imagekit.thumbnailUrl as string) ?? undefined,
      userId,
      parentId: null,
      isFolder: false,
      isStarred: false,
      isTrash: false,
    };

    const [newFile] = await db.insert(files).values(fileData).returning();

    return NextResponse.json(newFile);
  } catch (error) {
    // Log the full error detail for debugging
    console.error("Error saving file:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json(
      { error: "Failed to save file information" },
      { status: 500 }
    );
  }
}