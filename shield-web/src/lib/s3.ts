import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.S3_BUCKET_NAME || "hackathon-e1-t05-docs";

let cachedClient: S3Client | null = null;
let cachedRegion: string | null = null;

// 리전을 하드코딩하면 배정된 리전 외에는 AccessDenied가 나므로 EC2 메타데이터에서 읽어온다.
// EC2가 아닌 환경(로컬 등)에서는 메타데이터 엔드포인트에 닿지 않으니 폴백 리전을 쓴다
// (어차피 로컬은 자격증명도 없어서 업로드 자체가 실패하는 게 정상).
async function resolveRegion(): Promise<string> {
  if (cachedRegion) return cachedRegion;
  if (process.env.AWS_REGION) {
    cachedRegion = process.env.AWS_REGION;
    return cachedRegion;
  }
  try {
    const tokenRes = await fetch("http://169.254.169.254/latest/api/token", {
      method: "PUT",
      headers: { "X-aws-ec2-metadata-token-ttl-seconds": "21600" },
      signal: AbortSignal.timeout(1000),
    });
    const token = await tokenRes.text();
    const regionRes = await fetch(
      "http://169.254.169.254/latest/meta-data/placement/region",
      { headers: { "X-aws-ec2-metadata-token": token }, signal: AbortSignal.timeout(1000) }
    );
    cachedRegion = (await regionRes.text()).trim();
  } catch {
    cachedRegion = "ap-northeast-2"; // EC2가 아닌 환경(로컬)용 폴백
  }
  return cachedRegion;
}

async function getClient(): Promise<S3Client> {
  if (cachedClient) return cachedClient;
  const region = await resolveRegion();
  cachedClient = new S3Client({ region });
  return cachedClient;
}

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const client = await getClient();
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  );
  const region = await resolveRegion();
  return `https://${BUCKET}.s3.${region}.amazonaws.com/${key}`;
}
