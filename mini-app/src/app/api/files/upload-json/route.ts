import { NextRequest, NextResponse } from 'next/server';
import formidable, { Fields, Files, File as FormidableFile } from 'formidable';
import fs from 'fs';
import { verify } from 'jsonwebtoken';
import { toNodeJsRequest } from '../helpers/toNodeJsRequest';
import { minioClient } from '@/lib/minioClient';
import { filePrefix } from '@/lib/fileUtils';

export const dynamic = 'force-dynamic'; // ensures Next.js does not statically optimize this route

// Adjust to your environment variable key, e.g., process.env.ONTON_API_SECRET
const JWT_SECRET = process.env.ONTON_API_SECRET || 'fallback-secret';

/**
 * Converts the NextRequest into a Node.js-like req (IncomingMessage)
 * and parses it with formidable for file uploads.
 */
async function parseFormdata(req: NextRequest): Promise<{ fields: Fields; files: Files }> {
  const nodeReq = await toNodeJsRequest(req);
  const form = formidable({ multiples: false });

  return new Promise((resolve, reject) => {
    form.parse(nodeReq, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

/**
 * Mirrors the NestJS `@Post('upload-json')`
 * - Only JSON
 * - Max 200KB
 * - Now secured by JWT
 */
export async function POST(req: NextRequest) {
  // 1. Extract token from "Authorization: Bearer <token>"
  const authHeader = req.headers.get('authorization') ?? '';
  const [bearer, token] = authHeader.split(' ');

  if (bearer !== 'Bearer' || !token) {
    return NextResponse.json({ message: 'Unauthorized: missing token' }, { status: 401 });
  }

  // 2. Verify the token using JWT_SECRET
  try {
    verify(token, JWT_SECRET);
    // If it fails, an error is thrown, caught below
  } catch (err) {
    console.error('Invalid JWT:', err);
    return NextResponse.json({ message: 'Unauthorized: invalid token' }, { status: 401 });
  }

  // 3. If token is valid, proceed with JSON file upload
  try {
    // Parse form data
    const { fields, files } = await parseFormdata(req);

    // Extract bucket/subfolder
    const rawBucket = fields.bucketName ?? process.env.MINIO_ITEM_BUCKET ?? 'onton';
    const rawSubfolder = fields.subfolder ?? '';
    const bucketName = Array.isArray(rawBucket) ? rawBucket[0] : rawBucket;
    const subfolder = Array.isArray(rawSubfolder) ? rawSubfolder[0] : rawSubfolder;

    // Check the 'json' field in files
    const rawJsonFile = files.json; // Could be File | File[] | undefined
    if (!rawJsonFile) {
      return NextResponse.json({ message: 'No JSON file uploaded.' }, { status: 400 });
    }

    const jsonFile = Array.isArray(rawJsonFile) ? rawJsonFile[0] : rawJsonFile;
    if (!jsonFile) {
      return NextResponse.json({ message: 'No JSON file uploaded.' }, { status: 400 });
    }

    // Cast to FormidableFile
    const formFile = jsonFile as FormidableFile;

    // Validate type
    if (formFile.mimetype !== 'application/json') {
      return NextResponse.json({ message: 'Only JSON format is allowed.' }, { status: 400 });
    }

    // Validate size (max 200KB)
    if (formFile.size > 200 * 1024) {
      return NextResponse.json(
        { message: 'JSON file size exceeds the 200 KB limit.' },
        { status: 400 }
      );
    }

    // Read the file into a Buffer
    const fileData = fs.readFileSync(formFile.filepath);

    // Build the final path
    const finalFilename = subfolder
      ? `${subfolder}/${filePrefix()}${formFile.originalFilename}`
      : `${filePrefix()}${formFile.originalFilename}`;

    // Ensure bucket exists and has public read policy for public metadata buckets like sbt-collections
    try {
      const exists = await minioClient.bucketExists(bucketName);
      if (!exists) {
        await minioClient.makeBucket(bucketName);
      }
      if (bucketName === 'sbt-collections') {
        const publicReadPolicy = JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "PublicReadGetObject",
              Effect: "Allow",
              Principal: "*",
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${bucketName}/*`],
            },
          ],
        });
        await minioClient.setBucketPolicy(bucketName, publicReadPolicy);
      }
    } catch (bucketErr) {
      // Non-fatal: log and proceed
      console.warn(`upload-json: Bucket check/policy update failed for ${bucketName}:`, bucketErr);
    }

    // Upload to MinIO
    await minioClient.putObject(bucketName, finalFilename, fileData, formFile.size, {
      'Content-Type': 'application/json',
    });

    // Construct the public URL
    const jsonUrl = `${process.env.MINIO_PUBLIC_URL}/${bucketName}/${finalFilename}`;
    return NextResponse.json({ jsonUrl }, { status: 200 });
  } catch (error) {
    console.error('Error uploading JSON:', error);
    return NextResponse.json(
      { message: 'An error occurred during JSON upload.' },
      { status: 500 },
    );
  }
}
