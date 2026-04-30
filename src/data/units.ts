import type { UserProfile } from "./schema";
import type { Language } from "./i18n";

export type DistanceUnit = UserProfile["distanceUnit"];
export type WeightUnit = UserProfile["weightUnit"];

const M_TO_YD = 1.0936133;
const KG_TO_LB = 2.2046226;

function formatNumber(value: number, digits: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

export function metersToDisplay(valueM: number | undefined, unit: DistanceUnit) {
  if (typeof valueM !== "number") return undefined;
  return unit === "yd" ? valueM * M_TO_YD : valueM;
}

export function displayToMeters(value: number | undefined, unit: DistanceUnit) {
  if (typeof value !== "number") return undefined;
  return unit === "yd" ? value / M_TO_YD : value;
}

export function kgToDisplay(valueKg: number | undefined, unit: WeightUnit) {
  if (typeof valueKg !== "number") return undefined;
  return unit === "lb" ? valueKg * KG_TO_LB : valueKg;
}

export function displayToKg(value: number | undefined, unit: WeightUnit) {
  if (typeof value !== "number") return undefined;
  return unit === "lb" ? value / KG_TO_LB : value;
}

export function formatDistance(valueM: number | undefined, unit: DistanceUnit, digits = 0) {
  const value = metersToDisplay(valueM, unit);
  if (typeof value !== "number") return "-";
  return `${formatNumber(Number(value.toFixed(digits)), digits)}${unit}`;
}

export function distanceUnitLabel(unit: DistanceUnit, language: Language = "ko") {
  if (unit === "yd") return "yd";
  return language === "en" ? "m" : "미터";
}

export function formatDisplayDistance(value: number | undefined, unit: DistanceUnit, digits = 0, language: Language = "ko") {
  if (typeof value !== "number") return "-";
  return `${formatNumber(Number(value.toFixed(digits)), digits)}${distanceUnitLabel(unit, language)}`;
}

export function formatDistanceLong(valueM: number | undefined, unit: DistanceUnit, digits = 0, language: Language = "ko") {
  return formatDisplayDistance(metersToDisplay(valueM, unit), unit, digits, language);
}

export function formatWeight(valueKg: number | undefined, unit: WeightUnit, digits = 1) {
  const value = kgToDisplay(valueKg, unit);
  if (typeof value !== "number") return "-";
  return `${formatNumber(Number(value.toFixed(digits)), digits)}${unit}`;
}

export function displayDistanceInput(valueM: number | undefined, unit: DistanceUnit, digits = 0) {
  const value = metersToDisplay(valueM, unit);
  if (typeof value !== "number") return "";
  return formatNumber(Number(value.toFixed(digits)), digits);
}

export function displayWeightInput(valueKg: number | undefined, unit: WeightUnit, digits = 1) {
  const value = kgToDisplay(valueKg, unit);
  if (typeof value !== "number") return "";
  return formatNumber(Number(value.toFixed(digits)), digits);
}
