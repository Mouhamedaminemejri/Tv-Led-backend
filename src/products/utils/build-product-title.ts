type TitlePartsInput = {
  tvBacklightType?: string | null;
  brand?: string | null;
  tvSizeInch?: number | null;
  stripCount?: string | null;
  ledCount?: string | null;
  voltage?: number | null;
  length?: string | null;
};

function normalizeSpace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isMeaningfulNumber(v: number | null | undefined): v is number {
  return typeof v === 'number' && !Number.isNaN(v) && v > 0;
}

function isZeroLikeText(v: string): boolean {
  const n = v.trim().replace(',', '.');
  if (!n) return true;
  const parsed = Number(n);
  return !Number.isNaN(parsed) && parsed <= 0;
}

function isMeaningfulText(v: string | null | undefined): v is string {
  if (!isNonEmptyString(v)) return false;
  return !isZeroLikeText(v);
}

function toLengthCmDisplay(raw: string): string {
  const normalized = raw.replace(/,/g, '.');
  const matches = Array.from(normalized.matchAll(/(\d+(?:\.\d+)?)\s*(mm|мм|cm|см)?/gi));
  if (matches.length === 0) {
    const normalizedRaw = normalizeSpace(raw);
    return isMeaningfulText(normalizedRaw) ? normalizedRaw : '';
  }

  const parts = matches
    .map((m) => {
      const value = parseFloat(m[1]);
      if (Number.isNaN(value)) return null;
      const unit = (m[2] || '').toLowerCase();
      const cm = unit === 'cm' || unit === 'см' ? value : value / 10;
      if (cm <= 0) return null;
      const rendered = Number.isInteger(cm) ? cm.toString() : cm.toFixed(1).replace(/\.0$/, '');
      return `${rendered} cm`;
    })
    .filter((v): v is string => Boolean(v));

  return parts.join(' + ');
}

/**
 * Title format required by user:
 * tvBacklightType + brand tv + tvsize inch° + number strip + | + number led (Pieces) + | + voltage (V) + | + length (cm)
 *
 * Example:
 * "Direct LED Samsung TV 55 inch° 3 | 60 Pieces | 12 V | 65 cm"
 */
export function buildProductTitle(input: TitlePartsInput): string {
  const baseParts: string[] = [];
  const detailParts: string[] = [];

  baseParts.push(isNonEmptyString(input.tvBacklightType) ? normalizeSpace(input.tvBacklightType) : 'Direct LED');

  if (isNonEmptyString(input.brand)) {
    baseParts.push(normalizeSpace(input.brand), 'TV');
  } else {
    baseParts.push('TV');
  }

  if (isMeaningfulNumber(input.tvSizeInch)) {
    baseParts.push(`${input.tvSizeInch} inch°`);
  }

  if (isMeaningfulText(input.stripCount)) {
    detailParts.push(normalizeSpace(input.stripCount));
  }

  if (isMeaningfulText(input.ledCount)) {
    detailParts.push(`${normalizeSpace(input.ledCount)} Pieces`);
  }

  if (isMeaningfulNumber(input.voltage)) {
    detailParts.push(`${input.voltage} V`);
  }

  if (isNonEmptyString(input.length)) {
    const lengthDisplay = toLengthCmDisplay(normalizeSpace(input.length));
    if (isMeaningfulText(lengthDisplay)) {
      detailParts.push(lengthDisplay);
    }
  }

  const base = normalizeSpace(baseParts.join(' '));
  if (detailParts.length === 0) return base;
  return normalizeSpace(`${base} ${detailParts.join(' | ')}`);
}

