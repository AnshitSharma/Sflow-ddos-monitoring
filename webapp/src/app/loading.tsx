import { FlowLoader } from '@/components/loading';

// Shown while a route segment loads on navigation.
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div><FlowLoader label="Opening view" /></div>
    </div>
  );
}
