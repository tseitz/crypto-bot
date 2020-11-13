// TODO: make these fixed length arrays
export interface KrakenPriceInfo {
  [index: string]: {
    a: string[];
    b: string[];
    c: string[];
    h: string[];
    l: string[];
    o: string;
    p: string[];
    t: number[];
    v: string[];
  };
}

// a:(3) ['16235.70000', '1', '1.000']
// b:(3) ['16229.80000', '1', '1.000']
// c:(2) ['16227.60000', '0.01123332']
// h:(2) ['16472.00000', '16472.00000']
// l:(2) ['15960.00000', '15873.00000']
// o:'16299.90000'
// p:(2) ['16278.12122', '16235.30168']
// t:(2) [1767, 2353]
// v:(2) ['204.48735554', '261.89459523']
