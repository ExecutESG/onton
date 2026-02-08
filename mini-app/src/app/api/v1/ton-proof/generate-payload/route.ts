// app/api/ton-auth/generate-payload/route.ts
import { TonProofService } from "@/services/ton-proof-service";
import { createPayloadToken } from "@/server/utils/jwt";
import { NextResponse } from "next/server";
// Ensure you have these constants properly set up in a constants file or environment variables

export async function GET() {
  try {
    const service = new TonProofService();
    const payload = service.generatePayload();
    const payloadToken = await createPayloadToken({ address: payload });

    // Return the payload in JSON response
    return NextResponse.json({ payload: payloadToken });
  } catch (error) {
    // Handle any errors
    return NextResponse.json({ error: "Failed to generate payload" }, { status: 500 });
  }
}
