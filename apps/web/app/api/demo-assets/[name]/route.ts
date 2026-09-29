import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const allowedAssets = new Set(['epoch-a.pgm', 'epoch-b.pgm', 'registered.pgm', 'difference.pgm', 'residual.pgm']);

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!allowedAssets.has(name)) return new NextResponse('Not found', { status: 404 });

  try {
    const assetPath = path.join(process.cwd(), '..', '..', 'data', 'demo', name);
    const asset = await readFile(assetPath);
    return new NextResponse(asset, {
      headers: {
        'Cache-Control': 'public, max-age=3600, immutable',
        'Content-Type': 'application/octet-stream',
      },
    });
  } catch {
    return new NextResponse('Demonstration asset unavailable', { status: 503 });
  }
}
