import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.R2_BUCKET!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const VALID_PRINTERS = ['h2c', 'h2d', 'p1s'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const printer = req.query.printer as string;

  if (!printer || !VALID_PRINTERS.includes(printer)) {
    return res.status(400).json({ error: 'Invalid printer. Use: h2c, h2d, p1s' });
  }

  try {
    const prefix = `bambu/${printer}/`;
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix,
    });

    const response = await s3.send(command);
    const contents = response.Contents ?? [];

    const images = contents
      .map((obj) => {
        const key = obj.Key!;
        const match = key.match(/layer_(\d+)\.jpg$/);
        if (!match) return null;
        return {
          layer: parseInt(match[1], 10),
          url: `${R2_PUBLIC_URL}/${key}`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.layer - b!.layer);

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=10');
    return res.status(200).json({ printer, images });
  } catch (err) {
    console.error('R2 list error:', err);
    return res.status(500).json({ error: 'Failed to list images' });
  }
}
