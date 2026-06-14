export const BETS = [1000, 2000, 5000, 10000];
export const TOPUP_CODE = "MAXWIN123";
export const TOPUP_AMOUNT = 100000;
export const STARTING_BALANCE = 10000;
export const STORE_KEY = "dadu:balance";
export const INIT_KEY = "dadu:initialized";

export const fmt = (n) => new Intl.NumberFormat("id-ID").format(Math.round(n));

// Posisi pip (titik) pada grid 3x3 untuk tiap nilai dadu
export const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};
