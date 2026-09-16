import LabClient from '@/components/LabClient';
import { listAllPalettes } from '@/lib/palettes';

// The palette list includes whatever the team has saved, so it cannot be baked in at build time.
export const dynamic = 'force-dynamic';

export default async function Page() {
  // Read straight from the library rather than fetching our own API: same process, one less hop.
  const palettes = await listAllPalettes();
  return <LabClient initialPalettes={palettes} />;
}
