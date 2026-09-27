export interface Fund {
  id: string;
  name: string;
  description: string;
  goal: number;
  impact: { amount: number; text: string }[];
}

export const FUNDS: Fund[] = [
  {
    id: "general",
    name: "Where it's needed most",
    description: "Keeps SeniorLink free for every senior and volunteer in the Fredericton region.",
    goal: 10000,
    impact: [
      { amount: 10, text: "keeps SeniorLink running for one senior for a month" },
      { amount: 25, text: "covers ID checks for two new volunteers" },
      { amount: 50, text: "funds a month of reminder and alert messages for 100 seniors" },
    ],
  },
  {
    id: "gas",
    name: "Volunteer gas & bus fund",
    description: "Covers fuel and bus fare so volunteers can reach seniors in Oromocto and rural York County.",
    goal: 5000,
    impact: [
      { amount: 10, text: "covers gas for two grocery runs" },
      { amount: 25, text: "covers a round-trip ride from Oromocto to a Fredericton clinic" },
      { amount: 50, text: "gives a student volunteer a month of bus passes" },
    ],
  },
  {
    id: "snow",
    name: "Winter snow fund",
    description: "Shovels, ice melt and safety gear so volunteers can keep seniors' steps clear all winter.",
    goal: 3000,
    impact: [
      { amount: 10, text: "buys ice melt for one senior's steps all winter" },
      { amount: 25, text: "buys a sturdy shovel for a volunteer" },
      { amount: 50, text: "equips a volunteer with boots grips and a safety vest" },
    ],
  },
  {
    id: "safety",
    name: "Scam-safety workshops",
    description: "Free workshops at seniors' centres on spotting phone, text and online scams.",
    goal: 2500,
    impact: [
      { amount: 10, text: "prints scam-warning guides for 20 seniors" },
      { amount: 25, text: "brings one senior to a workshop, with a ride" },
      { amount: 50, text: "funds a workshop session at a seniors' centre" },
    ],
  },
];

export function fundById(id: string) {
  return FUNDS.find((f) => f.id === id);
}
