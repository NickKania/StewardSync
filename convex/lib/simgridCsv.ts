export interface SimGridDriver {
  username: string;
  realName: string;
  identifier: string;
  steam64Id: string;
  platform: string;
  carNumber?: string;
  carClass: string;
  carName: string;
  fiaEsportsLicenceNumber: string;
  registeredAt: string;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values;
}

export function parseSimGridDriversCsv(csvText: string): SimGridDriver[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (!lines[0]) {
    throw new Error("SimGrid returned an empty entry list");
  }

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.replace(/^\uFEFF/, "").toLowerCase(),
  );

  const drivers: SimGridDriver[] = [];

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;

    const values = parseCsvLine(line);
    const driver: Partial<SimGridDriver> = {};

    headers.forEach((header, index) => {
      const value = values[index] ?? "";
      switch (header) {
        case "username":
          driver.username = value;
          break;
        case "real name":
          driver.realName = value;
          break;
        case "identifier":
          driver.identifier = value;
          break;
        case "steam64_id":
          driver.steam64Id = value;
          break;
        case "platform":
          driver.platform = value;
          break;
        case "car number":
          driver.carNumber = value;
          break;
        case "car class":
          driver.carClass = value;
          break;
        case "car name":
          driver.carName = value;
          break;
        case "fia esports licence number":
          driver.fiaEsportsLicenceNumber = value;
          break;
        case "registered at":
          driver.registeredAt = value;
          break;
      }
    });

    drivers.push(driver as SimGridDriver);
  }

  const driversWithInvalidCarNumbers = drivers.filter(
    (driver) =>
      driver.carNumber?.trim() && !Number.isInteger(Number(driver.carNumber)),
  );
  if (driversWithInvalidCarNumbers.length > 0) {
    const usernames = driversWithInvalidCarNumbers
      .slice(0, 3)
      .map((driver) => driver.username || driver.realName || "unknown")
      .join(", ");
    throw new Error(
      `SimGrid entry list contains ${driversWithInvalidCarNumbers.length} driver(s) with an invalid car number (${usernames}).`,
    );
  }

  return drivers;
}
