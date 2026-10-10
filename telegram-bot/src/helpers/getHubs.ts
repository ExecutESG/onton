export type Hub = {
  id: number;
  name: string;
};

export type SocietyHub = Hub;

export const hardCodedHubs: Hub[] = [
  { id: 33, name: "Onton" },
  { id: 28, name: "Europe" },
  { id: 30, name: "CIS" },
  { id: 32, name: "UAE" },
  { id: 31, name: "Hong Kong" },
  { id: 34, name: "Korea" },
];

export async function getHubs(): Promise<Hub[]> {
  return hardCodedHubs;
}