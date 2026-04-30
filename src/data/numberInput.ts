type NumberInputOptions = {
  decimal?: boolean;
  signed?: boolean;
};

export function cleanNumberInput(value: string, options: NumberInputOptions = {}) {
  let next = value.replace(/[^\d.-]/g, "");

  if (!options.signed) {
    next = next.replace(/-/g, "");
  } else {
    next = next.replace(/(?!^)-/g, "");
  }

  if (!options.decimal) {
    return next.replace(/\./g, "");
  }

  const firstDot = next.indexOf(".");
  if (firstDot === -1) return next;

  return `${next.slice(0, firstDot + 1)}${next.slice(firstDot + 1).replace(/\./g, "")}`;
}
