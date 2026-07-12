import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const uptime = process.uptime();
    const timestamp = new Date().toISOString();

    // Define the path relative to the project's root directory
    const filePath = path.resolve(process.cwd(), "commit_details.txt");

    // Ensure the file is located within the expected directory (optional additional check)
    const allowedDir = process.cwd();
    if (!filePath.startsWith(allowedDir)) {
      return NextResponse.json(
            {
                error: "Access to the specified file is not allowed",
            },
            { status: 403 }
        );
    }

    // Read the file content
    let commitDetail = "unknown";
    try {
      const fileContent = await readFile(filePath, "utf-8");
      commitDetail = fileContent.replace(/\n/g, "   ||  ");
    } catch (e) {
      // Gracefully handle missing commit_details.txt file (e.g., in dev/staging/incomplete builds)
    }

    return NextResponse.json({
      success: true,
      message: "pong",
      server: {
        uptime: `${Math.floor(uptime)} seconds`,
        timestamp,
      },
      sha: commitDetail
    });
  } catch (error) {
    return NextResponse.json(
        {
          error: "An internal server error occurred", // Generic error message
        },
        { status: 500 }
    );
  }
}


export const dynamic = "force-dynamic";
