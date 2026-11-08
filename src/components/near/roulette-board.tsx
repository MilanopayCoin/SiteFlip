"use client";

import { useMemo } from "react";
import {
  CHIP_DENOMS,
  colorOf,
  type RouletteBet,
  type RouletteBetKind,
} from "@/lib/near/roulette";

const GRID: number[][] = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

function cellClass(n: number) {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-700 text-white";
  if (c === "red") return "bg-red-700 text-white";
  return "bg-zinc-950 text-white";
}

function chipsOn(
  bets: RouletteBet[],
  wallet: string | null,
  pred: (b: RouletteBet) => boolean
) {
  return bets
    .filter((b) => (!wallet || b.wallet === wallet) && pred(b))
    .reduce((s, b) => s + b.amount, 0);
}

function ChipStack({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  return (
    <span className="pointer-events-none absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#f5e6a3] bg-gradient-to-b from-[#ffe566] to-[#c9a227] px-1 text-[9px] font-bold text-[#1a1408] shadow">
      {amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount}
    </span>
  );
}

export function RouletteBoard({
  disabled,
  chip,
  onChip,
  bets,
  myWallet,
  onBet,
}: {
  disabled: boolean;
  chip: number;
  onChip: (n: number) => void;
  bets: RouletteBet[];
  myWallet: string | null;
  onBet: (input: {
    kind: RouletteBetKind;
    numbers?: number[];
    meta?: number;
  }) => void;
}) {
  const me = myWallet?.toLowerCase() || null;

  const streetFor = (row: number, col: number) => {
    // three numbers in a column of the layout (vertical street on real table is horizontal row)
    return [GRID[0]![col]!, GRID[1]![col]!, GRID[2]![col]!];
  };

  const myStake = useMemo(
    () =>
      bets.filter((b) => b.wallet === me).reduce((s, b) => s + b.amount, 0),
    [bets, me]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-[#c9a227]">
          Chip
        </span>
        {CHIP_DENOMS.map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => onChip(d)}
            className={`h-9 min-w-9 rounded-full border text-xs font-bold transition ${
              chip === d
                ? "border-[#ffe566] bg-[#c9a227] text-[#1a1408] scale-110"
                : "border-[#c9a227]/50 bg-[#1a1408] text-[#f5e6a3] hover:border-[#ffe566]"
            }`}
          >
            {d}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-white/50">
          Bahsin · {myStake}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#2a5a3c] bg-[#0d3d2a] p-2 shadow-inner">
        <div className="inline-flex min-w-[640px] gap-1">
          {/* Zero */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onBet({ kind: "straight", numbers: [0] })}
            className="relative flex w-10 flex-col justify-center rounded-md bg-emerald-700 text-sm font-semibold text-white"
          >
            0
            <ChipStack
              amount={chipsOn(
                bets,
                me,
                (b) => b.kind === "straight" && b.numbers[0] === 0
              )}
            />
          </button>

          <div className="flex-1 space-y-1">
            {GRID.map((row, ri) => (
              <div key={ri} className="grid grid-cols-12 gap-1">
                {row.map((n, ci) => (
                  <button
                    key={n}
                    type="button"
                    disabled={disabled}
                    onClick={() => onBet({ kind: "straight", numbers: [n] })}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (disabled) return;
                      // right-click: split with left neighbor if any
                      if (ci > 0) {
                        onBet({
                          kind: "split",
                          numbers: [row[ci - 1]!, n],
                        });
                      }
                    }}
                    className={`relative flex h-9 items-center justify-center rounded-sm text-xs font-semibold ${cellClass(n)} hover:ring-1 hover:ring-[#ffe566]/60`}
                  >
                    {n}
                    <ChipStack
                      amount={chipsOn(
                        bets,
                        me,
                        (b) => b.kind === "straight" && b.numbers[0] === n
                      )}
                    />
                  </button>
                ))}
              </div>
            ))}

            {/* Dozens */}
            <div className="grid grid-cols-3 gap-1 pt-1">
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={disabled}
                  onClick={() => onBet({ kind: "dozen", meta: d })}
                  className="relative rounded-sm border border-[#2f6b48] bg-[#0f4a32] py-2 text-[11px] font-semibold text-[#d7ffe6]"
                >
                  {d === 1 ? "1st 12" : d === 2 ? "2nd 12" : "3rd 12"}
                  <ChipStack
                    amount={chipsOn(
                      bets,
                      me,
                      (b) => b.kind === "dozen" && b.meta === d
                    )}
                  />
                </button>
              ))}
            </div>

            {/* Outside even money */}
            <div className="grid grid-cols-6 gap-1 pt-1">
              {(
                [
                  ["low", "1–18"],
                  ["even", "Çift"],
                  ["red", "Kırmızı"],
                  ["black", "Siyah"],
                  ["odd", "Tek"],
                  ["high", "19–36"],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  disabled={disabled}
                  onClick={() => onBet({ kind })}
                  className={`relative rounded-sm border py-2 text-[10px] font-semibold ${
                    kind === "red"
                      ? "border-red-800 bg-red-800/80 text-white"
                      : kind === "black"
                        ? "border-zinc-700 bg-zinc-950 text-white"
                        : "border-[#2f6b48] bg-[#0f4a32] text-[#d7ffe6]"
                  }`}
                >
                  {label}
                  <ChipStack
                    amount={chipsOn(bets, me, (b) => b.kind === kind)}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Columns 2:1 */}
          <div className="flex w-11 flex-col gap-1">
            {/* Top row is 3,6,9… → column 3 */}
            {[3, 2, 1].map((c) => (
              <button
                key={c}
                type="button"
                disabled={disabled}
                onClick={() => onBet({ kind: "column", meta: c })}
                className="relative flex flex-1 items-center justify-center rounded-md border border-[#2f6b48] bg-[#0f4a32] text-[10px] font-semibold text-[#d7ffe6]"
              >
                2:1
                <ChipStack
                  amount={chipsOn(
                    bets,
                    me,
                    (b) => b.kind === "column" && b.meta === c
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Quick streets */}
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="mr-1 self-center text-[9px] uppercase tracking-wide text-[#8fceb0]">
            Street
          </span>
          {Array.from({ length: 12 }, (_, ci) => {
            const nums = streetFor(0, ci);
            return (
              <button
                key={ci}
                type="button"
                disabled={disabled}
                onClick={() => onBet({ kind: "street", numbers: nums })}
                className="relative rounded border border-[#2f6b48]/80 px-1.5 py-0.5 font-mono text-[9px] text-[#b8e6cc]"
              >
                {nums[2]}-{nums[0]}
                <ChipStack
                  amount={chipsOn(
                    bets,
                    me,
                    (b) =>
                      b.kind === "street" &&
                      b.numbers.length === 3 &&
                      b.numbers[0] === nums[0]
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function RouletteHistory({
  history,
}: {
  history: { number: number; color: string }[];
}) {
  if (!history.length) {
    return (
      <p className="text-[11px] text-white/40">Henüz spin yok — yol boş.</p>
    );
  }
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {history.map((h, i) => (
        <span
          key={`${h.number}-${i}`}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
            h.color === "red"
              ? "bg-red-700 text-white"
              : h.color === "black"
                ? "bg-zinc-900 text-white"
                : "bg-emerald-700 text-white"
          }`}
        >
          {h.number}
        </span>
      ))}
    </div>
  );
}
