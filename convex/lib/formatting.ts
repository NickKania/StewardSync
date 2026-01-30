// Format driver name to "F. Name" format
// Examples:
//   "John Smith" → "J. Smith"
//   "Jane Doe" → "J. Doe"
//   "Robert Johnson Jr" → "R. Johnson Jr"
//   "María García López" → "M. García López"
//   "A. B. Smith" → "A. Smith" (handle already abbreviated)
export function formatDriverName(driverName: string): string {
  if (!driverName || driverName.trim().length === 0) {
    return driverName;
  }

  const trimmed = driverName.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length === 0) {
    return driverName;
  }

  // If there's only one word, return it capitalized
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  }

  // Check if the name already starts with an initial (e.g., "A. B. Smith")
  // If first part is already in "X." format, use it as-is
  const firstPart = parts[0];
  if (firstPart.length === 2 && firstPart[1] === '.') {
    // Already abbreviated, capitalize the initial and combine with rest
    const rest = parts.slice(1).join(' ');
    return firstPart[0].toUpperCase() + '. ' + rest;
  }

  // Format: First letter of first name + ". " + rest of name
  const firstInitial = firstPart.charAt(0).toUpperCase();
  const restOfName = parts.slice(1).join(' ');

  return `${firstInitial}. ${restOfName}`;
}

// Get display name with priority order:
// 1. User's officialName (if linked)
// 2. Driver's officialName
// 3. Driver's driverName (fallback)
export function getDriverDisplayName(
  driver: { driverName: string; officialName?: string },
  user?: { officialName?: string }
): string {
  if (user?.officialName) {
    return user.officialName;
  }
  if (driver.officialName) {
    return driver.officialName;
  }
  return driver.driverName;
}
