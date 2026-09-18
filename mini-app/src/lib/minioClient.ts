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
  }
}