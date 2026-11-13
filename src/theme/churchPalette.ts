/**
 * Cores digitais oficiais usadas no site churchofjesuschrist.org.
 * Fonte: Church Communication Guide 4.2.5 e tokens Unity.
 */
export const churchPalette = {
  blue: {
    5: "#B0EEFC",
    10: "#7DE3F4",
    15: "#49CCE6",
    20: "#01B6D1",
    25: "#007DA5",
    30: "#006184",
    35: "#005175",
    40: "#003057",
  },
  gray: {
    2: "#F7F8F8",
    3: "#EFF0F0",
    5: "#E0E2E2",
    15: "#BDC0C0",
    35: "#676B6E",
    40: "#53575B",
  },
  text: {
    primary: "#212225",
    secondary: "#53575B",
  },
  surface: {
    base: "#FFFFFF",
    subtle: "#EFF0F0",
    disabled: "#F7F8F8",
  },
  semantic: {
    success: "#318D43",
    warning: "#D45311",
    danger: "#B00504",
    red: "#BD0057",
  },
} as const;
