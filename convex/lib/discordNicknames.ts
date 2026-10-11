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
  setNickname(nickname: string, reason: string): Promise<unknown>;
}

interface NicknameGuild {
  members: { fetch(discordId: string): Promise<NicknameMember> };
}

const normalize = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

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
  // Match complete digit groups so number 1 cannot be satisfied by #12.
  const numbers = new Set(normalizedNickname.match(/\d+/g) ?? []);
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

      const nickname = buildDriverNickname(target);
      if (Array.from(nickname).length > 32) {
        throw new Error("Official name and car numbers exceed Discord's 32-character nickname limit");
      }

      await member.setNickname(nickname, "StewardSync driver import");
      result.updated++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      result.failed++;
      result.errors.push(`${target.officialName} (${target.discordId}): ${message}`);
    }
  }

  return result;
}
