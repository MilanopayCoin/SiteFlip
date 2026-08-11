import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <Card className="mt-6">
      <CardContent className="flex flex-col items-center py-12 text-center">
        <p className="text-lg font-medium text-white">{title}</p>
        <p className="mt-2 max-w-md text-sm text-zinc-400">{description}</p>
        {actionHref && actionLabel && (
          <Button className="mt-6" asChild>
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
