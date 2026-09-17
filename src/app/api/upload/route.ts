import { NextResponse, type NextRequest } from 'next/server';
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, saveUpload, type UploadMeta } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACCEPTED_LABEL = 'JPEG, PNG or WebP';

interface RejectedFile {
  name: string;
  reason: string;
}

/**
 * Accept one or more images and hold them in memory.
 *
 * Uploading once and referring to the result by id is what keeps the controls responsive: the
 * interactive preview re-renders from the stored copy instead of re-posting the original file on
 * every debounced change.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected a multipart form upload' }, { status: 400 });
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: 'No files were uploaded' }, { status: 400 });
  }

  const uploaded: UploadMeta[] = [];
  const rejected: RejectedFile[] = [];

  for (const file of files) {
    if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
      rejected.push({
        name: file.name,
        reason: `${file.type || 'unknown type'} is not supported. Use ${ACCEPTED_LABEL}.`,
      });
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      rejected.push({ name: file.name, reason: `${mb} MB is over the 25 MB limit.` });
      continue;
    }
    try {
      uploaded.push(await saveUpload(Buffer.from(await file.arrayBuffer()), file.name, file.type));
    } catch (err) {
      rejected.push({
        name: file.name,
        reason: err instanceof Error ? err.message : 'Could not read this image.',
      });
    }
  }

  const status = uploaded.length === 0 ? 400 : 200;
  return NextResponse.json({ uploaded, rejected }, { status });
}
