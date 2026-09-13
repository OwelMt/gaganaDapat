export const RELIEF_COUNT_LABELS = {
  households: "Households", families: "Families", male: "Male", female: "Female",
  lgbtq: "LGBTQ", pwd: "PWD", pregnant: "Pregnant", senior: "Senior",
  requestedFoodPacks: "Food Packs", individuals: "Individuals",
};

export const getAffectedPeopleCountForRow = (row = {}) =>
  Number(row.male || 0) + Number(row.female || 0);

export const getReliefRowPopulationError = (row = {}) => {
  for (const [field, label] of Object.entries(RELIEF_COUNT_LABELS)) {
    const rawValue = row[field] ?? 0;
    const value = Number(rawValue);
    if (!["number", "string"].includes(typeof rawValue) || !Number.isSafeInteger(value) || value < 0) {
      return `${label} must be a nonnegative whole number.`;
    }
  }
  const individuals = getAffectedPeopleCountForRow(row);
  if (!Number.isSafeInteger(individuals)) return "Individuals exceeds the supported whole-number range.";
  if (row.individuals !== undefined && row.individuals !== null && String(row.individuals).trim() !== "" && Number(row.individuals) !== individuals) {
    return `Individuals must equal Male + Female (${individuals}); received ${row.individuals}.`;
  }
  if (Number(row.pregnant || 0) > Number(row.female || 0)) {
    return `Pregnant cannot exceed Female (${Number(row.female || 0)}).`;
  }
  for (const field of ["lgbtq", "pwd", "senior"]) {
    if (Number(row[field] || 0) > individuals) {
      return `${RELIEF_COUNT_LABELS[field]} cannot exceed Individuals (${individuals}).`;
    }
  }
  if (row.isActiveRow !== false && individuals <= 0) return "Each active evacuation center row must include at least 1 affected person.";
  return "";
};

export const getReliefPopulationValidationError = (rows = []) => {
  const activeRows = (Array.isArray(rows) ? rows : []).filter((row) => row && row.isActiveRow !== false);
  if (!activeRows.length) return "At least one active evacuation center row is required.";
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return "Invalid evacuation center row.";
    const error = getReliefRowPopulationError(row);
    if (error) return error;
  }
  return "";
};
