export const BETS = [1000, 2000, 5000, 10000, 50000, 100000];
export const TOPUP_CODE = "MAXWIN123";
export const TOPUP_AMOUNT = 100000;
export const STARTING_BALANCE = 10000;
export const STORE_KEY = "dadu:balance";
export const INIT_KEY = "dadu:initialized";

export const fmt = (n) => new Intl.NumberFormat("id-ID").format(Math.round(n));

// Compact format for mobile wallet: max 5 significant digits shown
export const fmtShort = (n) => {
  const v = Math.round(n);
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1_000_000)     return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "jt";
  if (v >= 100_000)       return (v / 1_000).toFixed(0) + "rb";
  return fmt(v);
};

// Posisi pip (titik) pada grid 3x3 untuk tiap nilai dadu
export const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};
