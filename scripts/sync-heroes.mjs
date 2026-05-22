#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERO_LIST_URL = "https://pvp.qq.com/web201605/js/herolist.json";
const HERO_ICON_URL_TEMPLATE =
  "https://game.gtimg.cn/images/yxzj/img201606/heroimg/{hero_id}/{hero_id}.jpg";

const HERO_ROLE_MAP = {
  1: "战士",
  2: "法师",
  3: "坦克",
  4: "刺客",
  5: "射手",
  6: "辅助"
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const heroesDir = path.join(publicDir, "heroes");
const dataDir = path.join(publicDir, "data");
const heroesJsonPath = path.join(dataDir, "heroes.json");

async function main() {
  const previousData = await readPreviousData();
  const sourceHeroes = await fetchHeroList();
  const heroes = normalizeHeroes(sourceHeroes);
  const failedAssets = await downloadHeroIcons(heroes);

  const nextData = {
    schemaVersion: 1,
    source: HERO_LIST_URL,
    generatedAt: new Date().toISOString(),
    heroes
  };

  const summary = buildSummary(previousData?.heroes ?? [], heroes, failedAssets);

  await fs.mkdir(dataDir, { recursive: true });
  await writeJson(heroesJsonPath, nextData);

  printSummary(summary);
}

async function readPreviousData() {
  try {
    const raw = await fs.readFile(heroesJsonPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.heroes)) {
      return null;
    }
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw new Error(`Failed to read existing ${relativePath(heroesJsonPath)}: ${error.message}`);
  }
}

async function fetchHeroList() {
  const response = await fetch(HERO_LIST_URL, {
    headers: {
      Accept: "application/json,text/javascript,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch hero list: HTTP ${response.status}`);
  }

  const bytes = await response.arrayBuffer();
  const charset = getResponseCharset(response.headers.get("content-type"));
  const text = decodeResponse(bytes, charset);
  const parsed = JSON.parse(stripBom(text));

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid hero list: expected a JSON array");
  }

  return parsed;
}

function normalizeHeroes(sourceHeroes) {
  const seenIds = new Set();

  return sourceHeroes.map((sourceHero, index) => {
    validateSourceHero(sourceHero, index);

    const id = toInteger(sourceHero.ename);
    if (seenIds.has(id)) {
      throw new Error(`Invalid hero list: duplicate ename ${id}`);
    }
    seenIds.add(id);

    const name = String(sourceHero.cname).trim();
    const title = nullableString(sourceHero.title);
    const roleIds = normalizeRoleIds(sourceHero);
    const roles = mapRoleIds(roleIds);
    const skinNames = parseSkinNames(sourceHero.skin_name);

    const hero = {
      id,
      name,
      title,
      role: roles[0] ?? "未知",
      roles: roles.length > 0 ? roles : ["未知"],
      iconUrl: `heroes/${id}.jpg`,
      remoteIconUrl: heroIconUrl(id)
    };

    if (skinNames.length > 0) {
      hero.skinNames = skinNames;
    }

    const unknownRoleIds = roleIds.filter((roleId) => HERO_ROLE_MAP[roleId] === undefined);
    if (unknownRoleIds.length > 0) {
      hero.roleIds = roleIds;
      hero.unknownRoleIds = unknownRoleIds;
    }

    return hero;
  });
}

function validateSourceHero(sourceHero, index) {
  if (!sourceHero || typeof sourceHero !== "object" || Array.isArray(sourceHero)) {
    throw new Error(`Invalid hero at index ${index}: expected an object`);
  }

  if (!isIntegerLike(sourceHero.ename)) {
    throw new Error(`Invalid hero at index ${index}: required field ename must be an integer`);
  }

  if (typeof sourceHero.cname !== "string" || sourceHero.cname.trim() === "") {
    throw new Error(`Invalid hero ${sourceHero.ename}: required field cname must be a non-empty string`);
  }
}

function normalizeRoleIds(sourceHero) {
  return [sourceHero.hero_type, sourceHero.hero_type2]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => toInteger(value))
    .filter((value, index, values) => Number.isInteger(value) && values.indexOf(value) === index);
}

function mapRoleIds(roleIds) {
  return roleIds
    .map((roleId) => HERO_ROLE_MAP[roleId] ?? "未知")
    .filter((role, index, roles) => roles.indexOf(role) === index);
}

function parseSkinNames(value) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split("|")
    .map((skinName) => skinName.trim())
    .filter(Boolean);
}

async function downloadHeroIcons(heroes) {
  await fs.mkdir(heroesDir, { recursive: true });

  const failedAssets = [];

  for (const hero of heroes) {
    try {
      await downloadHeroIcon(hero);
    } catch (error) {
      failedAssets.push({
        id: hero.id,
        name: hero.name,
        url: hero.remoteIconUrl,
        reason: error.message
      });
    }
  }

  return failedAssets;
}

async function downloadHeroIcon(hero) {
  const response = await fetch(hero.remoteIconUrl);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.toLowerCase().includes("image/")) {
    throw new Error(`unexpected content-type ${contentType}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error("empty response body");
  }

  await fs.writeFile(path.join(heroesDir, `${hero.id}.jpg`), bytes);
}

function buildSummary(previousHeroes, nextHeroes, failedAssets) {
  const previousById = new Map(previousHeroes.map((hero) => [hero.id, hero]));
  const nextById = new Map(nextHeroes.map((hero) => [hero.id, hero]));

  const added = nextHeroes.filter((hero) => !previousById.has(hero.id));
  const removed = previousHeroes.filter((hero) => !nextById.has(hero.id));
  const changed = nextHeroes.filter((hero) => {
    const previousHero = previousById.get(hero.id);
    return previousHero !== undefined && stableJson(previousHero) !== stableJson(hero);
  });

  return {
    total: nextHeroes.length,
    added,
    removed,
    changed,
    failedAssets
  };
}

function printSummary(summary) {
  console.log("Hero data sync complete");
  console.log(`Total heroes: ${summary.total}`);
  console.log(`Added: ${formatHeroList(summary.added)}`);
  console.log(`Removed: ${formatHeroList(summary.removed)}`);
  console.log(`Changed: ${formatHeroList(summary.changed)}`);
  console.log(`Failed assets: ${formatFailedAssets(summary.failedAssets)}`);
  console.log(`Data written: ${relativePath(heroesJsonPath)}`);
  console.log(`Icons written: ${relativePath(heroesDir)}`);
}

function formatHeroList(heroes) {
  if (heroes.length === 0) {
    return "0";
  }
  return `${heroes.length} (${heroes.map((hero) => `${hero.id}:${hero.name}`).join(", ")})`;
}

function formatFailedAssets(failedAssets) {
  if (failedAssets.length === 0) {
    return "0";
  }
  return `${failedAssets.length} (${failedAssets
    .map((asset) => `${asset.id}:${asset.name} - ${asset.reason}`)
    .join(", ")})`;
}

function heroIconUrl(heroId) {
  return HERO_ICON_URL_TEMPLATE.replaceAll("{hero_id}", String(heroId));
}

function nullableString(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function isIntegerLike(value) {
  return Number.isInteger(toInteger(value));
}

function toInteger(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : Number.NaN;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return Number.NaN;
}

function getResponseCharset(contentType) {
  if (!contentType) {
    return "utf-8";
  }

  const match = contentType.match(/charset=([^;]+)/i);
  return match ? match[1].trim().toLowerCase() : "utf-8";
}

function decodeResponse(bytes, charset) {
  const primaryCharset = charset || "utf-8";
  try {
    return new TextDecoder(primaryCharset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function stripBom(value) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function stableJson(value) {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortObjectKeys(value[key])])
  );
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function relativePath(filePath) {
  return path.relative(projectRoot, filePath);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
