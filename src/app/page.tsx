import LabClient from '@/components/LabClient';
import { listAllPalettes } from '@/lib/palettes';

export default function Page() {
  return <LabClient palettes={listAllPalettes()} />;
}
