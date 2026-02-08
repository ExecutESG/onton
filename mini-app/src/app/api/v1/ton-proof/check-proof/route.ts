import { CheckProofRequest } from "@/types/ton-proof";
import { TonApiService } from "@/services/ton-api-service";
import { TonProofService } from "@/services/ton-proof-service";
import { createAuthToken, verifyToken } from "@/server/utils/jwt";
import { NextResponse } from "next/server";
import { logger } from "@/server/utils/logger";
/**
 * Checks the proof and returns an access token.
 *
 * POST /api/check_proof
 */
export const POST = async (req: Request) => {
  try {
    const body = CheckProofRequest.parse(await req.json());

    const client = TonApiService.create(body.network);
    const service = new TonProofService();

    const isValid = await service.checkProof(body, (address) => client.getWalletPublicKey(address));
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid proof" },
        {
          status: 400,
        }
      );
    }

    // const payloadToken = body.proof.payload;
    // if (!(await verifyToken(payloadToken))) {
    //   return NextResponse.json(
    //     { error: "Invalid token" },
    //     {
    //       status: 400,
    //     }
    //   );
    // }

    const token = await createAuthToken({
      address: body.address,
      network: body.network,
    });

    return NextResponse.json({ token });
  } catch (e) {
    logger.log("err", e);
    return NextResponse.json({ error: "Invalid request", trace: e }, { status: 500 });
  }
};
