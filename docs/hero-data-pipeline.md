# Hero Data Pipeline

## 1. Recommended Source

Use the official Honor of Kings website static hero list:

```text
https://pvp.qq.com/web201605/js/herolist.json
```

This is not a formal developer API, but it is the most direct structured source for hero IDs and names.

Do not use third-party personal APIs as the production source of truth.

## 2. Official Fields

The source JSON contains entries shaped like:

```json
{
  "ename": 105,
  "cname": "廉颇",
  "title": "正义爆轰",
  "hero_type": 3,
  "skin_name": "正义爆轰|地狱岩魂"
}
```

Important fields:

- `ename`: hero ID.
- `cname`: hero name.
- `title`: hero title.
- `hero_type`: primary role.
- `hero_type2`: secondary role, if present.
- `skin_name`: optional skin-name list.

## 3. Icon URL Rule

Hero avatar URL:

```text
https://game.gtimg.cn/images/yxzj/img201606/heroimg/{hero_id}/{hero_id}.jpg
```

Example:

```text
https://game.gtimg.cn/images/yxzj/img201606/heroimg/105/105.jpg
```

## 4. Local Generated Shape

Generate app data like:

```json
{
  "schemaVersion": 1,
  "source": "https://pvp.qq.com/web201605/js/herolist.json",
  "generatedAt": "2026-05-22T00:00:00.000Z",
  "heroes": [
    {
      "id": 105,
      "name": "廉颇",
      "title": "正义爆轰",
      "role": "坦克",
      "roles": ["坦克"],
      "iconUrl": "heroes/105.jpg",
      "remoteIconUrl": "https://game.gtimg.cn/images/yxzj/img201606/heroimg/105/105.jpg",
      "skinNames": ["正义爆轰", "地狱岩魂"]
    }
  ]
}
```

Use local `iconUrl` in the app. Keep `remoteIconUrl` for diagnostics or resync.

## 5. Role Mapping

Map official role IDs to Chinese labels:

```ts
const HERO_ROLE_MAP = {
  1: "战士",
  2: "法师",
  3: "坦克",
  4: "刺客",
  5: "射手",
  6: "辅助"
} as const;
```

If an unknown role ID appears, keep the numeric value in generated metadata and display `未知`.

## 6. Sync Script Behavior

Run:

```bash
npm run sync:heroes
```

The sync script should:

1. Fetch `herolist.json`.
2. Validate that the response is an array.
3. Validate each hero has `ename` and `cname`.
4. Generate normalized hero records.
5. Download each hero icon from the CDN rule.
6. Save icons as `public/heroes/{id}.jpg`.
7. Save generated metadata as `public/data/heroes.json`.
8. Print a summary of added, removed, changed, and failed assets.

The script should fail if `heroes.json` cannot be generated. It may continue when individual icons fail, but failed icon IDs must be reported.

## 7. Runtime Behavior

The app should load `public/data/heroes.json` from bundled assets.

Runtime should not require network access for normal BP simulation.

If an icon is missing:

- Show a neutral placeholder.
- Keep the hero selectable.
- Log the missing asset in development mode.

## 8. Future Extensions

Possible later additions:

- User-maintained hero aliases.
- KPL-specific common lane metadata.
- Version tags.
- Hero strength notes.
- Skin thumbnails.
- Skill icons.

Do not add skin or skill assets in MVP unless they are required by a specific feature.

## 9. Source References

Primary:

- `https://pvp.qq.com/web201605/herolist.shtml`
- `https://pvp.qq.com/web201605/js/herolist.json`
- `https://game.gtimg.cn/images/yxzj/img201606/heroimg/{hero_id}/{hero_id}.jpg`

Reference-only projects:

- `https://github.com/jieshenboy/HeadTogetherOfKOG`
- `https://github.com/yansheng836/hero-skin-images`
- `https://github.com/qing762/honor-of-kings-api`

Copyright/legal reference:

- `https://www.tencent.com/zh-cn/statement.html`
