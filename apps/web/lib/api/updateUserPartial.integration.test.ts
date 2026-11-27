import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import bcrypt from "bcrypt";

// A settings section saves only its own fields (plus id, username, email).
// Fields it leaves out, like the language and the avatar, must stay as they
// are (#1915, #1779). Against a real database (DATABASE_URL).

vi.mock("next-i18next.config", () => ({
  i18n: { locales: ["en", "de"] },
}));

vi.mock("@linkwarden/filesystem", () => ({
  createFile: vi.fn(),
  createFolder: vi.fn(),
  removeFile: vi.fn(),
  removeFolder: vi.fn(),
}));

let prisma: typeof import("@linkwarden/prisma").prisma;
let updateUserById: typeof import("./controllers/users/userId/updateUserById").default;

const run = `${Date.now().toString(36)}${Math.random()
  .toString(36)
  .slice(2, 6)}`;
const createdUserIds: number[] = [];

async function createAccount(label: string) {
  const user = await prisma.user.create({
    data: {
      name: label,
      username: `${label}-${run}`.toLowerCase(),
      password: await bcrypt.hash("Corr3ct-horse", 4),
      locale: "de",
      image: "uploads/avatar/1.jpg",
    },
  });
  createdUserIds.push(user.id);
  return user;
}

// What the preference page sends: the base payload plus the section's fields
const section = (
  user: { id: number; username: string | null; email: string | null },
  fields: Record<string, unknown>
) =>
  ({
    id: user.id,
    username: user.username,
    email: user.email,
    ...fields,
  }) as any;

const stored = (id: number) => prisma.user.findUniqueOrThrow({ where: { id } });

describe("saving one settings section, with a real database", () => {
  beforeAll(async () => {
    vi.stubEnv("EMAIL_FROM", "");
    vi.stubEnv("EMAIL_SERVER", "");
    ({ prisma } = await import("@linkwarden/prisma"));
    updateUserById = (await import("./controllers/users/userId/updateUserById"))
      .default;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it("keeps the language and the avatar when saving the AI tagging method", async () => {
    const user = await createAccount("ai-section");

    const result = await updateUserById(
      user.id,
      section(user, { aiTaggingMethod: "GENERATE", aiTagExistingLinks: false })
    );

    expect(result.status).toBe(200);
    expect((result.response as any).locale).toBe("de");
    expect((result.response as any).image).toMatch(/^uploads\/avatar\/1\.jpg\?/);
    const after = await stored(user.id);
    expect(after.aiTaggingMethod).toBe("GENERATE");
    expect(after.locale).toBe("de");
    expect(after.image).toBe("uploads/avatar/1.jpg");
  });

  it("keeps the language and the avatar when saving the archive settings", async () => {
    const user = await createAccount("archive-section");

    const result = await updateUserById(
      user.id,
      section(user, { archiveAsPDF: false, archiveAsScreenshot: false })
    );

    expect(result.status).toBe(200);
    const after = await stored(user.id);
    expect(after.archiveAsPDF).toBe(false);
    expect(after.locale).toBe("de");
    expect(after.image).toBe("uploads/avatar/1.jpg");
  });

  it("still changes the language when the account page sends one", async () => {
    const user = await createAccount("account-language");

    await updateUserById(user.id, section(user, { locale: "en" }));

    expect((await stored(user.id)).locale).toBe("en");
  });

  it("still falls back to English for an unknown language", async () => {
    const user = await createAccount("unknown-language");

    await updateUserById(user.id, section(user, { locale: "xx" }));

    expect((await stored(user.id)).locale).toBe("en");
  });

  it("still removes the avatar when the account page sends an empty one", async () => {
    const user = await createAccount("remove-avatar");

    await updateUserById(user.id, section(user, { image: "" }));

    expect((await stored(user.id)).image).toBe("");
  });
});
