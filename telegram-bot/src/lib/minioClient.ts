import { Client } from "minio";

export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT ?? (process.env.IP_MINIO || "minio"),
  port: Number(process.env.MINIO_PORT ?? "9000"),
  useSSL: false, // or true if you're using SSL
  accessKey: process.env.MINIO_ROOT_USER ?? "minioadmin",
  secretKey: process.env.MINIO_ROOT_PASSWORD ?? "minioadmin",
});

