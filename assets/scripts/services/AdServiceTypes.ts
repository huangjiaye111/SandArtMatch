export const AD_TYPE_STAMINA = "stamina" as const;
export const AD_TYPE_COINS = "coins" as const;
export const AD_TYPE_EXTRA_CARRIER = "extra_carrier" as const;

export type AdType = typeof AD_TYPE_STAMINA | typeof AD_TYPE_COINS | typeof AD_TYPE_EXTRA_CARRIER | string;
