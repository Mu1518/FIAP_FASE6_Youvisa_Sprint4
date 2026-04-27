function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#bfc9c4]/40 ${className ?? ''}`} />;
}

export function ProcessoCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#e0e0e0] bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Pulse className="h-5 w-32" />
        <Pulse className="h-6 w-24 rounded-full" />
      </div>
      <Pulse className="h-4 w-48" />
      <div className="space-y-2">
        <Pulse className="h-3 w-full" />
        <Pulse className="h-2 w-full rounded-full" />
      </div>
      <div className="flex items-center gap-4">
        <Pulse className="h-4 w-20" />
        <Pulse className="h-4 w-28" />
      </div>
    </div>
  );
}

export function ProcessoRowSkeleton() {
  return (
    <tr className="border-b border-gray-100">
      <td className="p-3"><Pulse className="h-4 w-10" /></td>
      <td className="p-3"><Pulse className="h-4 w-28" /></td>
      <td className="p-3"><Pulse className="h-4 w-24" /></td>
      <td className="p-3"><Pulse className="h-6 w-28 rounded-full" /></td>
      <td className="p-3"><Pulse className="h-4 w-20" /></td>
      <td className="p-3"><Pulse className="h-4 w-20" /></td>
    </tr>
  );
}

export function HandoffCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Pulse className="h-5 w-36" />
        <Pulse className="h-6 w-24 rounded-full" />
      </div>
      <Pulse className="h-4 w-48" />
      <Pulse className="h-4 w-32" />
    </div>
  );
}

export function DocumentoRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <Pulse className="h-8 w-8 rounded" />
        <div className="space-y-1">
          <Pulse className="h-4 w-40" />
          <Pulse className="h-3 w-24" />
        </div>
      </div>
      <Pulse className="h-6 w-20 rounded-full" />
    </div>
  );
}
