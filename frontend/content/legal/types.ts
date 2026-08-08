export type LegalSection = { num: string; heading: string; id: string; blocks: string[] };
export type LegalDoc = {
  title: string;
  updated: string;
  subtitle?: string;
  intro: string[];
  sections: LegalSection[];
};
