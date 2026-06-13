export interface LicensePointPenalty {
  licensePoints?: number | null;
  selfReportLicensePointReduction?: number | null;
}

export const getEffectiveLicensePoints = (
  penalty: LicensePointPenalty | null | undefined,
  isSelfReport: boolean | null | undefined,
): number => {
  const basePoints = penalty?.licensePoints ?? 0;
  const reduction = isSelfReport
    ? (penalty?.selfReportLicensePointReduction ?? 0)
    : 0;

  return Math.max(0, basePoints - reduction);
};
