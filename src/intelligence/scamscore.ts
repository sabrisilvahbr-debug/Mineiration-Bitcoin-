/** Rubrica preenchida por pessoa ou LLM; a NOTA é calculada aqui, em código. */
export interface Rubric {
  fixedReturnGuaranteed: boolean;
  referralBonus: boolean;
  opaqueContracts: boolean;
  noLegalEntityOrAudit: boolean;
  noWithdrawal: boolean;
  urgencyPressure: boolean;
  /** 0 = nenhuma reclamação relevante … 3 = muitas e graves. */
  complaintsLevel: 0 | 1 | 2 | 3;
}

/** Pesos: política inicial do design (a ideia não fixa valores); ajustáveis pelo CEO. */
export const WEIGHTS = {
  referralBonus: 30,
  opaqueContracts: 25,
  noLegalEntityOrAudit: 20,
  noWithdrawal: 40,
  urgencyPressure: 15,
  perComplaintLevel: 10,
} as const;

export const BLOCK_BELOW = 70;

export function scamScore(r: Rubric): { score: number; blocked: boolean; reasons: string[] } {
  if (r.fixedReturnGuaranteed) {
    return { score: 0, blocked: true, reasons: ["Rendimento fixo garantido: reprovado automaticamente"] };
  }
  let score = 100;
  const reasons: string[] = [];
  const hit = (cond: boolean, pts: number, why: string) => {
    if (cond) {
      score -= pts;
      reasons.push(`${why} (−${pts})`);
    }
  };
  hit(r.referralBonus, WEIGHTS.referralBonus, "Bônus por indicação");
  hit(r.opaqueContracts, WEIGHTS.opaqueContracts, "Contratos opacos");
  hit(r.noLegalEntityOrAudit, WEIGHTS.noLegalEntityOrAudit, "Sem CNPJ/endereço/auditoria");
  hit(r.noWithdrawal, WEIGHTS.noWithdrawal, "Impossibilidade de saque");
  hit(r.urgencyPressure, WEIGHTS.urgencyPressure, "Pressão de urgência");
  hit(r.complaintsLevel > 0, WEIGHTS.perComplaintLevel * r.complaintsLevel, `Reclamações (nível ${r.complaintsLevel})`);
  score = Math.max(0, score);
  return { score, blocked: score < BLOCK_BELOW, reasons };
}
