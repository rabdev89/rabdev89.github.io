const STATUS_STYLES: Record<string, string> = {
  UPLOADING: "bg-blue-500/10 text-blue-500",
  PROCESSING: "bg-yellow-500/10 text-yellow-500",
  READY: "bg-green-500/10 text-green-500",
  FAILED: "bg-red-500/10 text-red-500",
  SUCCEEDED: "bg-green-500/10 text-green-500",
  PENDING: "bg-gray-500/10 text-gray-500",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.PENDING;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}
