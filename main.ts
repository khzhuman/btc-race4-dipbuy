// Dip Buyer v2 — a dip-buying cbBTC bot for btc-race-24h-20261118-1444.
//
// The idea in one sentence: buy ALL of the cash into cbBTC the moment the
// price prints at or under a fixed dollar level, fall back to buying a dip
// off the trailing 60-minute peak if that level never prints, sell the whole
// position once the price has climbed 1.5% above the buy fill, then re-arm;
// if nothing has traded by the last three hours of the window, buy and hold.
//
// The level is the primary trigger on purpose. The previous race taught us
// a relative dip alone can sit unfilled while the peak slides down with the
// market, and a sell target that never prints strands the bot in a losing
// hold. So the level is absolute and set just under the market at build
// time ($63,000 against ~$63,500), the dip is only the backup, and the
// fallback guarantees at least one trade. Long only, no leverage, no
// stop-loss, one open position, cash never below zero.
//
// How it talks to the harness: hello opens the session, then one batch
// arrives per minute bar and the bot answers each batch with exactly one
// reply carrying its orders (at most one order here). An order decided on a
// batch fills at the next bar's open, so the buy price is the next open,
// never the close that triggered it. The entry price for the take-profit is
// the real fill price read back from the fills of the following batch,
// never an estimate. A full-size round trip costs about 26 bps in fees,
// slippage and impact, so a 1.5% dip plus a 1.5% take-profit leaves a wide
// margin over costs.
//
// Deterministic: no clock, no environment, no randomness — every decision
// is a pure function of the bars seen so far, so two runs agree byte for
// byte.
//
// Why these numbers (checked against the kit's published dev window before
// submitting): the dev window fell 2.8% end to end, and the previous race's
// 1.2% dip with a 1.5% take-profit buys once and never reaches its sell
// target there, ending about $18 under water. Deepening only the backup dip
// to 1.5% — the take-profit stays at 1.5% — buys the early dip, sells the
// bounce for about +$15, and re-arms; the late buy near the window's end
// costs almost nothing. The $63,000 level never prints on the dev window
// (its low is $63,027), so the dev result comes from the dip backup, while
// in the live race the level sits 0.8% under the ~$63,500 build-time price
// and is the trigger most likely to fire first.

import { runBars, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
// Rolling peak window, in 1-minute bars.
const PEAK_BARS = 60;
// Primary trigger: buy when the latest close prints at or under this level.
const ABS_LEVEL_USD = 63000n;
// Backup trigger: buy when the latest close sits at least this far below
// the trailing 60-bar peak. The level above is checked first.
const DIP_BPS = 150; // 1.5%
// Sell when the latest close sits at least this far above the buy fill.
const TAKE_PROFIT_BPS = 150; // 1.5%
// Last 3 hours of a 1440-bar window: buy and hold if nothing traded yet.
const FALLBACK_BAR = 1260;
// Max slippage vs the latest close; a 1-minute BTC move is far smaller.
const MAX_SLIPPAGE_BPS = 300;

let closes: bigint[] = [];
let entryPrice = 0n; // actual fill price of the open position; 0 while flat
let everTraded = false;
let barsSeen = 0;
let levelUnits = 0n; // ABS_LEVEL_USD in the bar price's own units

await runBars({
  onBatch(state, batch) {
    if (state.warmingUp) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];
    barsSeen += 1;

    // The absolute level in price units, from the symbol's own scale.
    if (levelUnits === 0n) {
      const scale = state.symbols.get(SYMBOL)?.price_scale ?? 5;
      levelUnits = ABS_LEVEL_USD * 10n ** BigInt(scale);
    }

    // Learn the true entry price from the fills of the previous batch.
    // A rejected buy leaves no fill, so the bot simply tries again.
    for (const fill of batch.fills) {
      if (fill.symbol !== SYMBOL || fill.status !== 'filled') continue;
      if (fill.side === 'buy') {
        entryPrice = BigInt(fill.price);
        everTraded = true;
      } else {
        entryPrice = 0n;
      }
      closes = [close];
    }

    const position = state.positions.get(SYMBOL);
    const qty = position?.qty ?? 0n;

    // Safety net: if a buy filled but its fill line never arrived, derive
    // the entry price from the position's cost. Cost is in quote units
    // (10^-6 USDC, fees included) and qty in qty-scale units, so the
    // conversion factor is 10^(price_scale + qty_scale - quote_scale).
    if (qty > 0n && entryPrice === 0n && position !== undefined && position.cost > 0n) {
      const sym = state.symbols.get(SYMBOL);
      const factor = 10n ** BigInt((sym?.price_scale ?? 5) + (sym?.qty_scale ?? 8) - state.hello.capital.quote_scale);
      entryPrice = (position.cost * factor) / qty;
      everTraded = true;
    }

    // Flat: hunt for the absolute level first, the dip second, the late
    // fallback last. Any one of them spends the whole cash balance.
    if (qty === 0n) {
      closes.push(close);
      if (closes.length > PEAK_BARS) closes.shift();
      const peak = closes.reduce((a, b) => (a > b ? a : b), 0n);
      const dipBps = peak > 0n ? ((peak - close) * 10000n) / peak : 0n;
      const levelReady = close <= levelUnits;
      const dipReady = closes.length >= PEAK_BARS && dipBps >= BigInt(DIP_BPS);
      const fallbackReady = !everTraded && barsSeen >= FALLBACK_BAR;
      if (levelReady || dipReady || fallbackReady) {
        const notional = state.cash;
        if (notional <= 0n) return [];
        const order: BuyInput = {
          side: 'buy',
          symbol: SYMBOL,
          notional_quote_units: notional,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        };
        return [order];
      }
      return [];
    }

    // Holding: sell the whole position once the close clears take-profit.
    if (entryPrice > 0n && close * 10000n >= entryPrice * BigInt(10000 + TAKE_PROFIT_BPS)) {
      const order: SellInput = {
        side: 'sell',
        symbol: SYMBOL,
        qty,
        max_slippage_bps: MAX_SLIPPAGE_BPS,
      };
      return [order];
    }
    return [];
  },
});
