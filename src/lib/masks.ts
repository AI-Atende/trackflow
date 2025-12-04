export const maskPhone = (value: string) => {
  if (!value) return "";

  // Remove non-digits
  const cleanValue = value.replace(/\D/g, "");

  // Limit to 11 digits (standard mobile)
  const limitedValue = cleanValue.slice(0, 11);

  // Apply mask (XX) XXXXX-XXXX
  if (limitedValue.length <= 2) {
    return limitedValue.replace(/^(\d{0,2})/, "($1");
  } else if (limitedValue.length <= 7) {
    return limitedValue.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
  } else {
    return limitedValue.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
  }
};

export const maskCEP = (value: string) => {
  if (!value) return "";

  // Remove non-digits
  const cleanValue = value.replace(/\D/g, "");

  // Limit to 8 digits
  const limitedValue = cleanValue.slice(0, 8);

  // Apply mask XXXXX-XXX
  if (limitedValue.length <= 5) {
    return limitedValue;
  } else {
    return limitedValue.replace(/^(\d{5})(\d{0,3})/, "$1-$2");
  }
};

// Helper to clean masks for API submission if needed
export const unmask = (value: string) => {
  return value.replace(/\D/g, "");
};
