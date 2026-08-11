import { describe, expect, it } from "bun:test";

import { parseSimGridDriversCsv } from "./simgridCsv";

describe("parseSimGridDriversCsv", () => {
  it("parses exports without the car number column", () => {
    const csv = [
      "username,real name,identifier,steam64_id,platform,car class,car name,fia esports licence number,registered at",
      "sierraalpha91,Shane Dodger | NRUS,steam64_id,76561198068906627,PC,Mazda MX-5 Cup - Pro-Am,Mazda MX-5 ND Cup - Global Cup ND2,,2026-07-22 00:38:55 UTC",
    ].join("\n");

    expect(parseSimGridDriversCsv(csv)).toEqual([
      {
        username: "sierraalpha91",
        realName: "Shane Dodger | NRUS",
        identifier: "steam64_id",
        steam64Id: "76561198068906627",
        platform: "PC",
        carClass: "Mazda MX-5 Cup - Pro-Am",
        carName: "Mazda MX-5 ND Cup - Global Cup ND2",
        fiaEsportsLicenceNumber: "",
        registeredAt: "2026-07-22 00:38:55 UTC",
      },
    ]);
  });

  it("parses a compatible export including quoted commas", () => {
    const csv = [
      "username,real name,identifier,steam64_id,platform,car number,car class,car name,fia esports licence number,registered at",
      'mixxd,"Cubbage, Jeremy",steam64_id,76561198021345559,PC,27,Mazda MX-5 Cup - Pro-Am,Mazda MX-5 ND Cup - Global Cup ND2,,2026-07-20 22:18:33 UTC',
    ].join("\r\n");

    expect(parseSimGridDriversCsv(csv)).toEqual([
      {
        username: "mixxd",
        realName: "Cubbage, Jeremy",
        identifier: "steam64_id",
        steam64Id: "76561198021345559",
        platform: "PC",
        carNumber: "27",
        carClass: "Mazda MX-5 Cup - Pro-Am",
        carName: "Mazda MX-5 ND Cup - Global Cup ND2",
        fiaEsportsLicenceNumber: "",
        registeredAt: "2026-07-20 22:18:33 UTC",
      },
    ]);
  });

  it("allows rows with blank car numbers", () => {
    const csv = [
      "username,real name,car number,car class",
      "mixxd,Jeremy Cubbage,,Mazda MX-5 Cup - Pro-Am",
    ].join("\n");

    expect(parseSimGridDriversCsv(csv)[0].carNumber).toBe("");
  });

  it("rejects non-numeric car numbers", () => {
    const csv = [
      "username,real name,car number,car class",
      "mixxd,Jeremy Cubbage,not-a-number,Mazda MX-5 Cup - Pro-Am",
    ].join("\n");

    expect(() => parseSimGridDriversCsv(csv)).toThrow(
      "contains 1 driver(s) with an invalid car number (mixxd)",
    );
  });
});
