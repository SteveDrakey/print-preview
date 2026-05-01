import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.R2_BUCKET!;

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const KEY_PATTERN = /^bambu\/(h2c|h2d|p1s)\/layer_\d+\.jpg$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = String(req.query.key ?? '');
  if (!KEY_PATTERN.test(key)) {
    return res.status(400).json({ error: 'invalid key' });
  }

  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    const body = obj.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
    if (!body?.transformToByteArray) {
      return res.status(500).json({ error: 'unexpected R2 body' });
    }
    const bytes = await body.transformToByteArray();
    res.setHeader('Content-Type', obj.ContentType ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.status(200).send(Buffer.from(bytes));
  } catch (err) {
    console.error('R2 get error:', err);
    return res.status(500).json({ error: 'fetch failed' });
  }
}
