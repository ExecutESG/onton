import { Client } from 'minio';

export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT ?? (process.env.IP_MINIO || 'minio'),
  port: Number(process.env.MINIO_PORT ?? '3012'),
  useSSL: false, // or true if you're using SSL
  accessKey: process.env.MINIO_ROOT_USER ?? 'minioadmin',
  secretKey: process.env.MINIO_ROOT_PASSWORD ?? 'minioadmin',
});

// Optional: If you want to ensure buckets are created (like init() in NestJS)
export async function ensureBucketsExist(bucketNames: string[], region?: string) {
  for (const bucket of bucketNames) {
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      await minioClient.makeBucket(bucket, region);
    }

    try {
      const publicReadPolicy = JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "PublicReadGetObject",
            Effect: "Allow",
            Principal: "*",
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${bucket}/*`],
          },
        ],
      });
      await minioClient.setBucketPolicy(bucket, publicReadPolicy);
    } catch (policyErr) {
      // Non-fatal if policy cannot be updated
      console.warn(`ensureBucketsExist: could not set public policy for bucket ${bucket}:`, policyErr);
    }
  }
}