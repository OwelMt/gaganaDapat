import {
  validateAddress,
  validateConfirmPassword,
  validateEmail,
  validateHotline,
  validatePhoneNumber,
  validateRegisterAccountForm,
  validateStrongPassword,
  validateUsername
} from "./inputValidators";

describe("inputValidators", () => {
  test("rejects missing and too-short usernames", () => {
    expect(validateUsername("")).toBe("Username is required");
    expect(validateUsername("ab")).toBe("Username must be at least 3 characters");
  });

  test("rejects malformed emails", () => {
    expect(validateEmail("")).toBe("Email is required");
    expect(validateEmail("wrong")).toBe("Enter a valid email address");
    expect(validateEmail("name@example.com")).toBe("");
  });

  test("requires phone numbers to start with 09 and be 11 digits", () => {
    expect(validatePhoneNumber("")).toBe("Phone number is required");
    expect(validatePhoneNumber("12345678901")).toBe(
      "Phone number must start with 09 and be 11 digits"
    );
    expect(validatePhoneNumber("09123456789")).toBe("");
  });

  test("rejects letter-only or too-short hotlines", () => {
    expect(validateHotline("")).toBe("");
    expect(validateHotline("abc")).toBe("Hotline must contain at least 7 digits");
    expect(validateHotline("044-123-4567")).toBe("");
  });

  test("requires readable addresses", () => {
    expect(validateAddress("")).toBe("Address is required");
    expect(validateAddress("abc")).toBe("Address must be at least 5 characters");
    expect(validateAddress("#####")).toBe("Address must contain readable details");
    expect(validateAddress("Purok 1, San Jose")).toBe("");
  });

  test("enforces strong passwords and confirmation", () => {
    expect(validateStrongPassword("")).toBe("Password is required");
    expect(validateStrongPassword("password1")).toBe(
      "Password must start with a capital letter"
    );
    expect(validateStrongPassword("Password")).toBe(
      "Password must contain at least one number"
    );
    expect(validateStrongPassword("Password1")).toBe(
      "Password must contain at least one special character"
    );
    expect(validateStrongPassword("Password1!")).toBe("");

    expect(validateConfirmPassword("Password1!", "")).toBe(
      "Please confirm the password"
    );
    expect(validateConfirmPassword("Password1!", "Password2!")).toBe(
      "Passwords do not match"
    );
    expect(validateConfirmPassword("Password1!", "Password1!")).toBe("");
  });

  test("validates register account fields with the shared inline rules", () => {
    expect(
      validateRegisterAccountForm({
        role: "barangay",
        username: "",
        email: "wrong",
        phoneNumber: "123",
        hotline: "abc",
        address: "###",
        password: "password1",
        confirmPassword: "password2",
        barangay: ""
      })
    ).toEqual({
      username: "Username is required",
      email: "Enter a valid email address",
      phoneNumber: "Phone number must start with 09 and be 11 digits",
      hotline: "Hotline must contain at least 7 digits",
      address: "Address must be at least 5 characters",
      password: "Password must start with a capital letter",
      confirmPassword: "Passwords do not match",
      barangay: "Barangay is required"
    });
  });

  test("allows optional hotline when register account fields are valid", () => {
    expect(
      validateRegisterAccountForm({
        role: "drrmo",
        username: "drrmoUser",
        email: "name@example.com",
        phoneNumber: "09123456789",
        hotline: "",
        address: "Purok 1, Jaen",
        password: "Password1!",
        confirmPassword: "Password1!",
        barangay: ""
      })
    ).toEqual({});
  });
});
