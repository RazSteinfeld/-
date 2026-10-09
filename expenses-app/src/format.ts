const LRM = '‎';

function group(n: number): string {
  return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** ₪1,234 – עטוף ב-LRM כדי שהסימן והמטבע יוצגו נכון בתוך טקסט RTL. */
export function fmtMoney(n: number, opts: { sign?: boolean; decimals?: boolean } = {}): string {
  const abs = Math.abs(n);
  let body: string;
  if (opts.decimals) {
    const [i, f] = abs.toFixed(2).split('.');
    body = `${i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${f}`;
  } else {
    body = group(abs);
  }
  const rounded = opts.decimals ? Math.round(abs * 100) : Math.round(abs);
  const sign = rounded === 0 ? '' : n < 0 ? '-' : opts.sign ? '+' : '';
  return `${LRM}${sign}₪${body}`;
}

export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${LRM}${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 10_000) return `${LRM}${Math.round(n / 1000)}K`;
  if (abs >= 1_000) return `${LRM}${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${LRM}${Math.round(n)}`;
}

export function fmtPct(n: number, sign = false): string {
  const r = Math.round(n);
  return `${LRM}${sign && r > 0 ? '+' : r < 0 ? '-' : ''}${Math.abs(r)}%`;
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`;
}
