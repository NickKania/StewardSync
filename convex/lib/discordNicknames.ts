export interface DriverNicknameTarget {
  discordId: string;
  officialName: string;
  driverNumbers: number[];
}

export interface DriverNicknameTargets {
  targets: DriverNicknameTarget[];
  skipped: number;
}

export interface NicknameSyncResult {
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  errors: string[];
}

interface NicknameMember {
  nickname: string | null;
  /** False when Discord forbids the bot from renaming this member (owner/higher role). */
  manageable?: boolean;
  setNickname(nickname: string, reason: string): Promise<unknown>;
}

interface NicknameGuild {
  members: { fetch(discordId: string): Promise<NicknameMember> };
}

// Fold accents, curly apostrophes, and hyphen/space variants so equivalent
// nicknames ("Maria Garcia", "Anne Marie", "O’Neil") are not rewritten.
const normalize = (value: string): string =>
  value
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/-/g, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

export function buildDriverNickname(target: DriverNicknameTarget): string {
  const name = target.officialName.trim().replace(/\s+/g, " ");
  const numbers = [...new Set(target.driverNumbers)].sort((a, b) => a - b);
  return numbers.length > 0 ? `${name} #${numbers.join("/")}` : name;
}

/** Allow extra nickname text between name parts and independently of numbers. */
export function matchesDriverNickname(
  nickname: string | null,
  target: DriverNicknameTarget,
): boolean {
  if (!nickname || !target.officialName.trim()) return false;

  const normalizedNickname = normalize(nickname);
  const nameParts = normalize(target.officialName).split(" ");
  // Match complete digit groups that are not glued to letters, so number 1
  // cannot be satisfied by #12 and number 3 cannot be satisfied by "GT3".
  // Leading zeros are ignored so #07 satisfies car number 7.
  const numbers = new Set(
    [...normalizedNickname.matchAll(/(?:^|[^\p{L}\p{M}\p{N}])(\d+)(?=$|[^\p{L}\p{M}\p{N}])/gu)]
      .map((match) => match[1].replace(/^0+(?=\d)/, "")),
  );
  return (
    nameParts.every((part) => {
      const escapedPart = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Unicode boundaries keep Ann distinct from Joanne without rejecting
      // punctuation, initials, or extra nickname text between official parts.
      return new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}])${escapedPart}(?=$|[^\\p{L}\\p{M}\\p{N}])`, "u")
        .test(normalizedNickname);
    }) &&
    target.driverNumbers.every((number) => numbers.has(String(number)))
  );
}

export async function syncDriverNicknames(
  guild: NicknameGuild,
  { targets, skipped }: DriverNicknameTargets,
): Promise<NicknameSyncResult> {
  const result: NicknameSyncResult = {
    updated: 0,
    unchanged: 0,
    skipped,
    failed: 0,
    errors: [],
  };

  // Sequential requests let discord.js handle rate limits for the import batch.
  for (const target of targets) {
    try {
      const member = await guild.members.fetch(target.discordId);
      if (matchesDriverNickname(member.nickname, target)) {
        result.unchanged++;
        continue;
      }
      // The bot can never rename the guild owner or higher-roled members;
      // counting them as failures on every import would just create noise.
      if (member.manageable === false) {
        result.skipped++;
        continue;
      }

      const nickname = buildDriverNickname(target);
      if (Array.from(nickname).length > 32) {
        throw new Error("Official name and car numbers exceed Discord's 32-character nickname limit");
      }

      await member.setNickname(nickname, "StewardSync driver import");
      result.updated++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      // Linked users who are not in the Discord server are skipped, not failed.
      const code = (error as { code?: unknown } | null)?.code;
      if (code === 10007 || message.includes("Unknown Member")) {
        result.skipped++;
        continue;
      }
      result.failed++;
      result.errors.push(`${target.officialName} (${target.discordId}): ${message}`);
    }
  }

  return result;
}
