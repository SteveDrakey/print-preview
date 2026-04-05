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

    const allImages = contents
      .map((obj) => {
        const key = obj.Key!;
        const match = key.match(/layer_(\d+)\.jpg$/);
        if (!match) return null;
        return {
          layer: parseInt(match[1], 10),
          url: `${R2_PUBLIC_URL}/${key}`,
          timestamp: obj.LastModified?.getTime() ?? 0,
        };
      })
      .filter(Boolean) as { layer: number; url: string; timestamp: number }[];

    // Sort by layer number ascending
    allImages.sort((a, b) => a.layer - b.layer);

    // Filter out stale images from previous print jobs.
    // Find the newest timestamp among all images — that's the current job.
    // Any image older than the earliest image in the current job's run is stale.
    // Walk backwards from the newest: as long as timestamps stay recent, keep them.
    // Once we hit a layer whose timestamp is much older, everything from there is old.
    if (allImages.length > 1) {
      // Find the timestamp of the lowest-numbered layer (start of current job)
      const lowestLayerTime = allImages[0].timestamp;

      // Keep only images that are not older than the lowest layer.
      // If layer 1 was uploaded at 13:41 and layer 1753 was uploaded at 10:35,
      // then 1753 is from a previous job.
      const filtered = allImages.filter((img) => img.timestamp >= lowestLayerTime);
      allImages.length = 0;
      allImages.push(...filtered);
    }

    // Append timestamp as cache-buster so CDN-edge doesn't serve stale versions
    // when a file is overwritten (e.g. layer_20 from old job → new job)
    const images = allImages.map(({ layer, url, timestamp }) => ({
      layer,
      url: `${url}?v=${timestamp}`,
    }));

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=10');
    return res.status(200).json({ printer, images });
  } catch (err) {
    console.error('R2 list error:', err);
    return res.status(500).json({ error: 'Failed to list images' });
  }
}
