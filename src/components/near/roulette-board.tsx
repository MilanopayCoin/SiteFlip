"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const DESIGN_W = 720;

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
    <span className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full border border-[#f5e6a3] bg-gradient-to-b from-[#ffe566] to-[#c9a227] px-0.5 text-[8px] font-bold text-[#1a1408] shadow">
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
  const shellRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      setScale(Math.min(1, w / DESIGN_W));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const streetFor = (col: number) => [
    GRID[0]![col]!,
    GRID[1]![col]!,
    GRID[2]![col]!,
  ];

  const myStake = useMemo(
    () =>
      bets.filter((b) => b.wallet === me).reduce((s, b) => s + b.amount, 0),
    [bets, me]
  );

  const boardH = 268;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="shrink-0 text-[9px] uppercase tracking-[0.16em] text-[#c9a227]">
          Chip
        </span>
        {CHIP_DENOMS.map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => onChip(d)}
            className={`h-8 w-8 shrink-0 rounded-full border text-[10px] font-bold transition active:scale-95 ${
              chip === d
                ? "border-[#ffe566] bg-[#c9a227] text-[#1a1408] ring-2 ring-[#ffe566]/40"
                : "border-[#c9a227]/50 bg-[#1a1408] text-[#f5e6a3]"
            }`}
          >
            {d}
          </button>
        ))}
        <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] text-white/50">
          Bahis · {myStake}
        </span>
      </div>

      {/* Scale-to-fit: full European layout always visible on phone */}
      <div
        ref={shellRef}
        className="w-full overflow-hidden rounded-xl border border-[#2a5a3c] bg-[#0d3d2a] shadow-inner"
        style={{ height: boardH * scale }}
      >
        <div
          style={{
            width: DESIGN_W,
            height: boardH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          className="p-2"
        >
          <div className="flex gap-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onBet({ kind: "straight", numbers: [0] })}
              className="relative flex w-9 shrink-0 flex-col justify-center rounded-md bg-emerald-700 text-sm font-semibold text-white active:brightness-110"
              style={{ minHeight: 118 }}
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

            <div className="min-w-0 flex-1 space-y-1">
              {GRID.map((row, ri) => (
                <div key={ri} className="grid grid-cols-12 gap-0.5">
                  {row.map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={disabled}
                      onClick={() => onBet({ kind: "straight", numbers: [n] })}
                      className={`relative flex h-9 items-center justify-center rounded-sm text-[11px] font-semibold active:brightness-125 ${cellClass(n)}`}
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

              <div className="grid grid-cols-3 gap-0.5 pt-0.5">
                {[1, 2, 3].map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={disabled}
                    onClick={() => onBet({ kind: "dozen", meta: d })}
                    className="relative rounded-sm border border-[#2f6b48] bg-[#0f4a32] py-1.5 text-[10px] font-semibold text-[#d7ffe6] active:brightness-110"
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

              <div className="grid grid-cols-6 gap-0.5 pt-0.5">
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
                    className={`relative rounded-sm border py-1.5 text-[9px] font-semibold active:brightness-110 ${
                      kind === "red"
                        ? "border-red-800 bg-red-800/90 text-white"
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

            <div className="flex w-9 shrink-0 flex-col gap-0.5">
              {[3, 2, 1].map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={disabled}
                  onClick={() => onBet({ kind: "column", meta: c })}
                  className="relative flex flex-1 items-center justify-center rounded-md border border-[#2f6b48] bg-[#0f4a32] text-[9px] font-semibold text-[#d7ffe6] active:brightness-110"
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

          <div className="mt-1.5 flex flex-wrap items-center gap-0.5">
            <span className="mr-1 text-[8px] uppercase tracking-wide text-[#8fceb0]">
              Street
            </span>
            {Array.from({ length: 12 }, (_, ci) => {
              const nums = streetFor(ci);
              return (
                <button
                  key={ci}
                  type="button"
                  disabled={disabled}
                  onClick={() => onBet({ kind: "street", numbers: nums })}
                  className="relative rounded border border-[#2f6b48]/80 px-1 py-0.5 font-mono text-[8px] text-[#b8e6cc] active:brightness-110"
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
    <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
