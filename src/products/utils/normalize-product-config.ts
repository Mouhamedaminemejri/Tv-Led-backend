export type ProductConfig = Record<string, unknown> & {
  Hide?: boolean | null;
  discount?: boolean | null;
  discountedPrice?: number | null;
  estimatedDeliveryGapHours?: number | null;
  deliveryMethods?: string[];
};

export type NormalizedProductConfig = {
  configString: string;
  hide: boolean | null;
  discount: boolean | null;
};

const DEFAULT_CONFIG: Required<
  Pick<ProductConfig, 'Hide' | 'discount' | 'discountedPrice' | 'estimatedDeliveryGapHours' | 'deliveryMethods'>
> = {
  Hide: null,
  discount: null,
  discountedPrice: null,
  estimatedDeliveryGapHours: null,
  deliveryMethods: [],
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Accepts a JSON string (or undefined) and returns a normalized JSON string
 * that always contains:
 * - `Hide` (boolean | null, default null)
 * - `discount` (boolean | null, default null)
 * - `discountedPrice` (number | null, default null)
 * - `estimatedDeliveryGapHours` (number | null, default null)
 * - `deliveryMethods` (string[], default [])
 */
export function normalizeProductConfig(config?: string): NormalizedProductConfig {
  if (config === undefined || config === null || config.trim() === '') {
    const configString = JSON.stringify(DEFAULT_CONFIG);
    return { configString, hide: DEFAULT_CONFIG.Hide, discount: DEFAULT_CONFIG.discount };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(config);
  } catch {
    throw new Error('Invalid config JSON');
  }

  if (!isPlainObject(parsed)) {
    throw new Error('Config must be a JSON object');
  }

  // Support user sending "hide" or "Hide"
  const hideRaw = parsed.Hide ?? parsed.hide;
  const discountRaw = parsed.discount ?? parsed.Discount;
  const discountedPriceRaw =
    parsed.discountedPrice ??
    parsed.discountPrice ??
    parsed.discounted_price;
  const estimatedDeliveryGapHoursRaw =
    parsed.estimatedDeliveryGapHours ??
    parsed.estimatedDeliveryGap ??
    parsed.estimatedDeliveryGapHour;
  const deliveryMethodsRaw =
    parsed.deliveryMethods ??
    parsed.deliveryMethod;

  const estimatedDeliveryGapHours: number | null =
    typeof estimatedDeliveryGapHoursRaw === 'number' &&
      Number.isFinite(estimatedDeliveryGapHoursRaw) &&
      estimatedDeliveryGapHoursRaw >= 0
      ? estimatedDeliveryGapHoursRaw
      : DEFAULT_CONFIG.estimatedDeliveryGapHours;

  const discountedPrice: number | null =
    typeof discountedPriceRaw === 'number' &&
      Number.isFinite(discountedPriceRaw) &&
      discountedPriceRaw >= 0
      ? discountedPriceRaw
      : DEFAULT_CONFIG.discountedPrice;

  const deliveryMethods = Array.isArray(deliveryMethodsRaw)
    ? deliveryMethodsRaw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
    : DEFAULT_CONFIG.deliveryMethods;

  const normalized: ProductConfig = {
    ...parsed,
    Hide: typeof hideRaw === 'boolean' ? hideRaw : DEFAULT_CONFIG.Hide,
    discount: typeof discountRaw === 'boolean' ? discountRaw : DEFAULT_CONFIG.discount,
    discountedPrice,
    estimatedDeliveryGapHours,
    deliveryMethods,
  };

  const configString = JSON.stringify(normalized);
  return {
    configString,
    hide: normalized.Hide ?? null,
    discount: normalized.discount ?? null,
  };
}

