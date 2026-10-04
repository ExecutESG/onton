import { ensureBucketsExist } from "@/lib/minioClient";

// Hardcode your desired bucket names (no environment variables)
const bucketNames = [
  'ontoncollection',
  'ontonitem',
  'ontonimage',
  'ontonvideo',
  'ontondoc',
  'sbt-collections',
  'csbt-trees',
  'onton',
  'ontonorganizerprofiles',
];

// Hardcode your region name
const regionName = 'default';

async function main() {
  // This will ensure each bucket in `bucketNames` exists,
  // creating them in region `regionName` if they do not.
  await ensureBucketsExist(bucketNames, regionName);
  console.log('Buckets ensured!');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
