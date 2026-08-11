export const getEvacuationCapacityErrors = (
  formData,
  { maxCapacityValue, maxFloorAreaValue, formatNumber }
) => {
  const capacityIndividual = Number(formData.capacityIndividual || 0);
  const capacityFamily = Number(formData.capacityFamily || 0);
  const bedCapacity = Number(formData.bedCapacity || 0);
  const floorArea = Number(formData.floorArea || 0);
  const errors = {};

  if (capacityIndividual <= 0 || capacityIndividual > maxCapacityValue) {
    errors.capacityIndividual = `Individual capacity must be between 1 and ${formatNumber(maxCapacityValue)}.`;
  }

  if (capacityFamily <= 0 || capacityFamily > maxCapacityValue) {
    errors.capacityFamily = `Family capacity must be between 1 and ${formatNumber(maxCapacityValue)}.`;
  }

  if (bedCapacity < 0 || bedCapacity > maxCapacityValue) {
    errors.bedCapacity = `Bed capacity must be between 0 and ${formatNumber(maxCapacityValue)}.`;
  }

  if (floorArea <= 0 || floorArea > maxFloorAreaValue) {
    errors.floorArea = `Floor area must be between 1 and ${formatNumber(maxFloorAreaValue)}.`;
  }

  return errors;
};
