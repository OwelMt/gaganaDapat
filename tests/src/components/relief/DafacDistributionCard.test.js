import { render, screen } from "@testing-library/react";
import DafacDistributionCard from "./DafacDistributionCard";

test("shows age for the family head and every member, including infants", () => {
  render(<DafacDistributionCard record={{ headOfFamily: { surname: "Cruz", firstName: "Ana", age: 35 }, familyMembers: [
    { fullName: "Ben Cruz", age: 12 }, { fullName: "Baby Cruz", age: 0 }, { fullName: "Cara Cruz", age: 8 }
  ] }} visibility={{}} />);
  expect(screen.getByLabelText("Family Head Age")).toHaveValue("35");
  expect(screen.getByText("Ben Cruz - 12 years")).toBeInTheDocument();
  expect(screen.getByText("Baby Cruz - 0 years")).toBeInTheDocument();
  expect(screen.getByText("Cara Cruz - 8 years")).toBeInTheDocument();
});

test("does not label missing ages as zero", () => {
  render(<DafacDistributionCard record={{ familyMembers: [{ fullName: "Ben Cruz" }] }} visibility={{}} />);
  expect(screen.getByLabelText("Family Head Age")).toHaveValue("");
  expect(screen.getByText("Ben Cruz - Age not entered")).toBeInTheDocument();
});
