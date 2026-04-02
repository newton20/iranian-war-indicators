export default function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-surface border border-border p-12 text-center">
      <p className="text-muted text-sm">{message}</p>
    </div>
  );
}
