// Organizations that recognise volunteer hours. Connections are simulated in this prototype.
export interface CreditOrg {
  id: string;
  name: string;
  short: string;
  program: string;
  description: string;
  idLabel: string;
  idPlaceholder: string;
  color: string;
}

export const CREDIT_ORGS: CreditOrg[] = [
  {
    id: "unb",
    name: "University of New Brunswick",
    short: "UNB",
    program: "Co-Curricular Record",
    description: "Verified hours are added to your official UNB Co-Curricular Record.",
    idLabel: "UNB email",
    idPlaceholder: "jdoe@unb.ca",
    color: "#B01C2E",
  },
  {
    id: "stu",
    name: "St. Thomas University",
    short: "STU",
    program: "Experiential Learning",
    description: "Count your community work toward STU experiential learning recognition.",
    idLabel: "STU email",
    idPlaceholder: "jdoe@stu.ca",
    color: "#00613A",
  },
  {
    id: "nbcc",
    name: "New Brunswick Community College",
    short: "NBCC",
    program: "Community Service Hours",
    description: "Share verified service hours with your NBCC program.",
    idLabel: "NBCC student number",
    idPlaceholder: "e.g. 0412345",
    color: "#005DAA",
  },
  {
    id: "dofe",
    name: "Duke of Edinburgh's Award (Canada)",
    short: "DofE",
    program: "Service section",
    description: "Log hours toward the Service section of your Bronze, Silver or Gold Award.",
    idLabel: "Award participant email",
    idPlaceholder: "you@example.com",
    color: "#5B2D82",
  },
];

export const MILESTONES = [10, 25, 50, 100, 250];

export function orgById(id: string) {
  return CREDIT_ORGS.find((o) => o.id === id);
}
