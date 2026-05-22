export interface HeroRecord {
  id: number;
  name: string;
  title: string;
  role: string;
  roles: string[];
  iconUrl: string;
  remoteIconUrl: string;
  skinNames?: string[];
  roleIds?: number[];
  unknownRoleIds?: number[];
}

export interface HeroDataFile {
  schemaVersion: 1;
  source: string;
  generatedAt: string;
  heroes: HeroRecord[];
}

export async function loadLocalHeroData(): Promise<HeroDataFile> {
  const response = await fetch("data/heroes.json");

  if (!response.ok) {
    throw new Error(`Failed to load local hero data: HTTP ${response.status}`);
  }

  const data = (await response.json()) as Partial<HeroDataFile>;

  if (data.schemaVersion !== 1 || !Array.isArray(data.heroes)) {
    throw new Error("Invalid local hero data file");
  }

  return data as HeroDataFile;
}
