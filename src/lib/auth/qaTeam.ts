/** The QA team: the people whose Team is "QA", "QA Team", "Quality Assurance" or "Testing". They test what is handed to them as Ready for QA and mark it Done. */
export const isQaTeam = (team?: string | null): boolean => /^(qa|quality assurance|testing)( team)?$/i.test((team ?? "").replace(/\s+/g, " ").trim());
