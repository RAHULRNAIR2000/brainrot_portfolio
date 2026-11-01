// Fairness knobs for the cone round. Tune here.
export const RULES = {
  maxFails: 5,
  maxSeconds: 25,
  baseCatchRadius: 0.17,
  triggerRadius: 0.42,
  shrinkPerFail: 0.88, // dodge distance x0.88 per fail (-12%)
  growPerFail: 1.1, // catch radius x1.1 per fail (+10%)
  luckyChance: 0.15,
  tellTime: 0.25,
  baseWindow: 0.4,
  autoTeaseAfter: 3.2,
}
