// Pure validation rules for the IdForm playerID input. Lives in its
// own file so the rules can be unit-tested without pulling React,
// stagebook, or @empirica/core through the vitest runner.

export const validateId = (id) => {
  const validatedId = id ? id.trim() : "";
  const errors = [];

  const disallow = /[^a-zA-Z0-9\-_]/g;
  const invalidChars = validatedId.match(disallow);
  if (invalidChars) {
    errors.push(
      `Please remove invalid characters: "${invalidChars.join(
        `", "`,
      )}", you may use a-z, A-Z, 0-9, "_" and "-".`,
    );
  } else if (validatedId.length < 2) {
    errors.push("Please enter at least 2 characters");
  } else if (validatedId.length > 64) {
    errors.push("Please enter no more than 64 characters");
  }
  return { validatedId, errors };
};
