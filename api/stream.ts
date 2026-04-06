import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
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

const VALID_PRINTERS = ['h2c', 'h2d', 'p1s'];
const TARGET_DURATION_MS = 30_000;
const MIN_FRAME_MS = 80;
const MAX_FRAME_MS = 500;
const TOP_HOLD_FRAMES = 6;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const printer = req.query.printer as string;
  const limitParam = req.query.frames as string | undefined;
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  if (!printer || !VALID_PRINTERS.includes(printer)) {
    return res.status(400).json({ error: 'Invalid printer' });
  }

  try {
    // List and filter images (same logic as /api/images)
    const prefix = `bambu/${printer}/`;
    const listRes = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix }));
    const contents = listRes.Contents ?? [];

    let allImages = contents
      .map((obj) => {
        const match = obj.Key!.match(/layer_(\d+)\.jpg$/);
        if (!match) return null;
        return { layer: parseInt(match[1], 10), key: obj.Key!, timestamp: obj.LastModified?.getTime() ?? 0 };
      })
      .filter(Boolean) as { layer: number; key: string; timestamp: number }[];

    allImages.sort((a, b) => a.layer - b.layer);

    if (allImages.length > 1) {
      const lowestLayerTime = allImages[0].timestamp;
      allImages = allImages.filter((img) => img.timestamp >= lowestLayerTime);
    }

    // Apply frame limit
    if (limit > 0) {
      allImages = allImages.slice(-limit);
    }

    if (allImages.length === 0) {
      return res.status(404).json({ error: 'No images found' });
    }

    // Build expanded frame sequence with gap-fill and top hold
    const expanded: { layer: number; key: string }[] = [];
    for (let i = 0; i < allImages.length; i++) {
      const current = allImages[i];
      const next = allImages[i + 1];
      const hold = next ? Math.min(next.layer - current.layer, 5) : 1;
      for (let j = 0; j < hold; j++) expanded.push(current);
    }
    for (let j = 0; j < TOP_HOLD_FRAMES; j++) expanded.push(expanded[expanded.length - 1]);

    // Calculate frame timing
    const rawMs = TARGET_DURATION_MS / expanded.length;
    const frameMs = Math.max(MIN_FRAME_MS, Math.min(MAX_FRAME_MS, Math.round(rawMs)));

    // Fetch all unique JPEG blobs upfront
    const uniqueKeys = [...new Set(expanded.map((f) => f.key))];
    const jpegCache = new Map<string, Buffer>();
    await Promise.all(
      uniqueKeys.map(async (key) => {
        const obj = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
        const chunks: Uint8Array[] = [];
        const body = obj.Body as AsyncIterable<Uint8Array>;
        for await (const chunk of body) chunks.push(chunk);
        jpegCache.set(key, Buffer.concat(chunks));
      }),
    );

    // Stream as MJPEG
    const boundary = 'frame';
    res.setHeader('Content-Type', `multipart/x-mixed-replace; boundary=${boundary}`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for (const frame of expanded) {
      const jpeg = jpegCache.get(frame.key)!;
      res.write(`--${boundary}\r\n`);
      res.write(`Content-Type: image/jpeg\r\n`);
      res.write(`Content-Length: ${jpeg.length}\r\n\r\n`);
      res.write(jpeg);
      res.write('\r\n');

      // Wait between frames
      await new Promise((resolve) => setTimeout(resolve, frameMs));

      // Client disconnected
      if (res.writableEnded) break;
    }

    res.write(`--${boundary}--\r\n`);
    res.end();
  } catch (err) {
    console.error('Stream error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Stream failed' });
    }
    res.end();
  }
}

export const config = {
  maxDuration: 60,
};
