// lib/nombreEnLettres.ts
// Conversion nombre -> lettres (français), suffixe " FCFA"

const UNITES = [
  "", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

function moinsDeMillier(n: number): string {
  if (n === 0) return "";
  if (n < 20) return UNITES[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    if (d === 7) return "soixante-" + UNITES[10 + u];
    if (d === 8) return u === 0 ? "quatre-vingts" : "quatre-vingt-" + UNITES[u];
    if (d === 9) return "quatre-vingt-" + UNITES[10 + u];
    if (u === 0) return DIZAINES[d];
    if (u === 1) return DIZAINES[d] + "-et-un";
    return DIZAINES[d] + "-" + UNITES[u];
  }
  const c = Math.floor(n / 100);
  const reste = n % 100;
  const centStr = c === 1 ? "cent" : UNITES[c] + " cent" + (reste === 0 && c > 1 ? "s" : "");
  return centStr + (reste > 0 ? " " + moinsDeMillier(reste) : "");
}

export function nombreEnLettres(valeur: number): string {
  if (!valeur || isNaN(valeur) || valeur === 0) return "";
  let n = Math.floor(valeur);
  let result = "";
  if (n >= 1000000) {
    const m = Math.floor(n / 1000000);
    result += (m === 1 ? "un million" : moinsDeMillier(m) + " millions") + " ";
    n %= 1000000;
  }
  if (n >= 1000) {
    const k = Math.floor(n / 1000);
    result += (k === 1 ? "mille" : moinsDeMillier(k) + " mille") + " ";
    n %= 1000;
  }
  result += moinsDeMillier(n);
  const lettres = result.trim();
  return lettres.charAt(0).toUpperCase() + lettres.slice(1) + " FCFA";
}
