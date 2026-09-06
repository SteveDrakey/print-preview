import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import type { ListObjectsV2CommandOutput, _Object } from '@aws-sdk/client-s3';
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
    // ListObjectsV2 caps a page at 1000 keys and pages in lexicographic order
    // (layer_0, layer_1, layer_10, layer_100, ...), so an unpaginated call on a
    // long print drops a scattered subset of the job's layers rather than a tail.
    const contents: _Object[] = [];
    let continuationToken: string | undefined;
    do {
      const response: ListObjectsV2CommandOutput = await s3.send(
        new ListObjectsV2Command({
          Bucket: R2_BUCKET,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      contents.push(...(response.Contents ?? []));
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

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
    // Layer 1 marks the start of every job, so its timestamp anchors the current run.
    // Layer 0 is unreliable as an anchor — it can persist for weeks across jobs.
    if (allImages.length > 1) {
      const layer1 = allImages.find((img) => img.layer === 1);
      const anchorTime = layer1?.timestamp ?? allImages[0].timestamp;
      const filtered = allImages.filter((img) => img.timestamp >= anchorTime);
      allImages.length = 0;
      allImages.push(...filtered);
    }

    // Append timestamp as cache-buster so CDN-edge doesn't serve stale versions
    // when a file is overwritten (e.g. layer_20 from old job → new job)
    const images = allImages.map(({ layer, url, timestamp }) => ({
      layer,
      url: `${url}?v=${timestamp}`,
      timestamp,
    }));

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=10');
    return res.status(200).json({ printer, images });
  } catch (err) {
    console.error('R2 list error:', err);
    return res.status(500).json({ error: 'Failed to list images' });
  }
}
