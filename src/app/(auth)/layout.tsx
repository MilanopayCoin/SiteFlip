export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <p className="font-display text-2xl font-semibold tracking-tight text-foreground">
          JIY
        </p>
        <p className="mt-1 text-sm text-muted">Verified digital businesses</p>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
