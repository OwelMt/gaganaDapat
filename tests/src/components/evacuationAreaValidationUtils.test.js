import { getEvacuationCapacityErrors } from "./evacuationAreaValidationUtils";

describe("getEvacuationCapacityErrors", () => {
  const formatNumber = (value) => Number(value).toLocaleString();

  it("requires individual capacity, family capacity, and floor area to be above zero", () => {
    const errors = getEvacuationCapacityErrors(
      {
        capacityIndividual: "0",
        capacityFamily: "0",
        bedCapacity: "0",
        floorArea: "0",
      },
      {
        maxCapacityValue: 1000000,
        maxFloorAreaValue: 1000000,
        formatNumber,
      }
    );

    expect(errors).toEqual({
      capacityIndividual: "Individual capacity must be between 1 and 1,000,000.",
      capacityFamily: "Family capacity must be between 1 and 1,000,000.",
      floorArea: "Floor area must be between 1 and 1,000,000.",
    });
  });

  it("allows bed capacity to be zero", () => {
    const errors = getEvacuationCapacityErrors(
      {
        capacityIndividual: "1",
        capacityFamily: "1",
        bedCapacity: "0",
        floorArea: "1",
      },
      {
        maxCapacityValue: 1000000,
        maxFloorAreaValue: 1000000,
        formatNumber,
      }
    );

    expect(errors).toEqual({});
  });
});
