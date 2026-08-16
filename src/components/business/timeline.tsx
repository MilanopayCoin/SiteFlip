"use client";

import { motion } from "framer-motion";
import type { BusinessEvent } from "@/types/database";

export function BusinessTimeline({ events }: { events: BusinessEvent[] }) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  return (
    <div className="relative space-y-0">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-violet-500/50 via-white/10 to-transparent" />
      {sorted.map((event, i) => (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.06 }}
          className="relative flex gap-4 pb-8 last:pb-0"
        >
          <div className="relative z-10 mt-1.5 h-4 w-4 shrink-0 rounded-full border-2 border-violet-400 bg-[#07070c]" />
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {new Date(event.occurred_at).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
            <p className="mt-1 font-medium text-white">{event.title}</p>
            {event.description && (
              <p className="mt-0.5 text-sm text-zinc-400">{event.description}</p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
