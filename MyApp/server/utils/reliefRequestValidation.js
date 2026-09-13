const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getActiveReliefRows = (rows = []) =>
  (Array.isArray(rows) ? rows : []).filter((row) => row && row.isActiveRow !== false);

const getAffectedPeopleCountForRow = (row = {}) =>
  toNumber(row.male) + toNumber(row.female);

const isBlank = (value) => value == null || (typeof value === "string" && value.trim() === "");
const isCount = (value) => isBlank(value) || (
  (typeof value === "number" || typeof value === "string") &&
  Number.isSafeInteger(Number(value)) && Number(value) >= 0
);

const getReliefPopulationValidationError = (rows = []) => {
  const activeRows = getActiveReliefRows(rows);

  if (!activeRows.length) {
    return "At least one active evacuation center row is required.";
  }

  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return `Row ${index + 1}: invalid evacuation center row.`;
    }
    const prefix = `Row ${index + 1}${row.evacuationCenterName ? ` (${row.evacuationCenterName})` : ""}`;
    for (const field of ["households", "families", "male", "female", "lgbtq", "pwd", "pregnant", "senior", "requestedFoodPacks", "individuals"]) {
      if (!isCount(row[field])) {
        return `${prefix}: ${field} must be a nonnegative safe whole integer.`;
      }
    }
    const individuals = getAffectedPeopleCountForRow(row);
    if (!Number.isSafeInteger(individuals)) {
      return `${prefix}: Individuals must be a safe whole integer.`;
    }
    if (!isBlank(row.individuals) && Number(row.individuals) !== individuals) {
      return `${prefix}: Individuals must equal Male + Female (${individuals}).`;
    }
    if (toNumber(row.pregnant) > toNumber(row.female)) {
      return `${prefix}: Pregnant cannot exceed Female (${toNumber(row.female)}).`;
    }
    for (const field of ["lgbtq", "pwd", "senior"]) {
      if (toNumber(row[field]) > individuals) {
        return `${prefix}: ${field} cannot exceed Individuals (${individuals}).`;
      }
    }
  }

  const hasZeroPopulationRow = activeRows.some(
    (row) => getAffectedPeopleCountForRow(row) <= 0
  );

  if (hasZeroPopulationRow) {
    return "Each active evacuation center row must include at least 1 affected person.";
  }

  return null;
};

module.exports = {
  getActiveReliefRows,
  getAffectedPeopleCountForRow,
  getReliefPopulationValidationError,
};
