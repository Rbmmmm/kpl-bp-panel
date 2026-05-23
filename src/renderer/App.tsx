import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyBan,
  applyPick,
  completeGame,
  createGlobalBpGame,
  createMatch,
  createPeakDuelGame,
  getCurrentBpStep,
  getSideForTeam,
  getTeamForSide,
  submitPeakDuelLineup,
  type BpStep,
  type GameState,
  type MatchState,
  type PeakDuelLineup,
  type RuleResult,
  type Side,
  type TeamId,
  YUANLIUZHIZI_BP_UNITS
} from "../domain";
import type { ElectronApi, FileDialogResult, MenuCommand, PersistenceError } from "../shared/electron-api";
import { validateMatchState } from "../shared/match-persistence";
import {
  downloadMatchFile,
  loadBrowserAutosave,
  openMatchFile,
  saveBrowserAutosave
} from "./browserPersistence";
import { loadLocalHeroData, type HeroRecord } from "./heroData";
import { getDisplayScore } from "./matchDisplay";

const PLAYER_ROLES = ["对抗路", "打野", "中路", "发育路", "游走"] as const;
const SUMMONER_SKILLS = ["闪现", "惩击", "治疗", "净化", "狂暴", "弱化", "干扰", "眩晕", "斩杀"];
const NORMAL_BAN_SLOT_COUNT = 5;
const NORMAL_PICK_SLOT_COUNT = 5;
const SIDES: Side[] = ["blue", "red"];
const TEAMS: TeamId[] = ["teamA", "teamB"];

type NoticeKind = "info" | "error" | "success";

type PeakSlotDraft = {
  playerName: string;
  heroId?: number;
  summonerSkill: string;
};

type ActivePeakSlot = {
  teamId: TeamId;
  slotIndex: number;
} | null;

const sideText: Record<Side, string> = {
  blue: "蓝色方",
  red: "红色方"
};

const actionText: Record<BpStep["action"], string> = {
  ban: "禁用",
  pick: "选用"
};

const yuanliuzhiziRoleText = {
  tank: "坦克",
  mage: "法师",
  assassin: "刺客",
  marksman: "射手",
  support: "辅助"
} as const;

const yuanliuzhiziIconFallback = {
  tank: "heroes/581.jpg",
  mage: "heroes/582.jpg",
  assassin: "heroes/583.jpg",
  marksman: "heroes/584.jpg",
  support: "heroes/585.jpg"
} as const;

const menuStatus: Record<MenuCommand, string> = {
  "new-match": "已新建比赛，当前存档会自动写入应用数据目录。",
  "open-match": "已打开比赛文件。",
  "save-match": "比赛文件已保存。",
  "export-match": "比赛结果已导出。"
};

function desktopApi(): ElectronApi | undefined {
  return window.kplBpPanel;
}

function defaultPlayers(teamId: TeamId) {
  return PLAYER_ROLES.map((role, index) => ({
    id: `${teamId}-${index + 1}`,
    name: `${teamId === "teamA" ? "A" : "B"}${role}`,
    role
  }));
}

function createInitialMatch() {
  return createMatch({
    teamAName: "蓝队",
    teamBName: "红队",
    teamAPlayers: defaultPlayers("teamA"),
    teamBPlayers: defaultPlayers("teamB"),
    firstSideSelectionTeam: "teamA"
  });
}

function createPeakDrafts(match: MatchState): Record<TeamId, PeakSlotDraft[]> {
  return {
    teamA: createTeamPeakDraft(match, "teamA"),
    teamB: createTeamPeakDraft(match, "teamB")
  };
}

function createTeamPeakDraft(match: MatchState, teamId: TeamId): PeakSlotDraft[] {
  const players = match.teams[teamId].players.length ? match.teams[teamId].players : defaultPlayers(teamId);

  return PLAYER_ROLES.map((role, index) => ({
    playerName: players[index]?.name ?? `${match.teams[teamId].name}${role}`,
    heroId: undefined,
    summonerSkill: index === 1 ? "惩击" : "闪现"
  }));
}

function currentGame(match: MatchState): GameState | undefined {
  return match.games[match.currentGameIndex - 1];
}

function isGlobalBpComplete(game?: GameState): boolean {
  return Boolean(
    game &&
      game.mode === "global_bp" &&
      !getCurrentBpStep(game) &&
      game.bans.blue.length === NORMAL_BAN_SLOT_COUNT &&
      game.bans.red.length === NORMAL_BAN_SLOT_COUNT &&
      game.picks.blue.length === NORMAL_PICK_SLOT_COUNT &&
      game.picks.red.length === NORMAL_PICK_SLOT_COUNT
  );
}

function normalizeHeroDataForBp(heroes: HeroRecord[]): HeroRecord[] {
  const yuanliuzhiziSourceByRole = new Map<string, HeroRecord>();
  const nonYuanliuzhiziHeroes: HeroRecord[] = [];

  for (const hero of heroes) {
    const role = getYuanliuzhiziRoleFromHero(hero);
    if (role) {
      yuanliuzhiziSourceByRole.set(role, hero);
    } else {
      nonYuanliuzhiziHeroes.push(hero);
    }
  }

  const yuanliuzhiziBpHeroes = Object.values(YUANLIUZHIZI_BP_UNITS).map((unit) => {
    const source = yuanliuzhiziSourceByRole.get(unit.role);
    const roleText = yuanliuzhiziRoleText[unit.role];

    return {
      id: unit.id,
      name: unit.displayName,
      title: source?.title ?? "元流之子职业形态",
      role: roleText,
      roles: [roleText],
      iconUrl: source?.iconUrl ?? yuanliuzhiziIconFallback[unit.role],
      remoteIconUrl: source?.remoteIconUrl ?? "",
      skinNames: source?.skinNames,
      roleIds: source?.roleIds,
      unknownRoleIds: source?.unknownRoleIds
    } satisfies HeroRecord;
  });

  return [...nonYuanliuzhiziHeroes, ...yuanliuzhiziBpHeroes].sort((left, right) => left.id - right.id);
}

function getYuanliuzhiziRoleFromHero(hero: HeroRecord): keyof typeof yuanliuzhiziRoleText | undefined {
  if (!hero.name.includes("元流之子")) {
    return undefined;
  }

  return Object.entries(yuanliuzhiziRoleText).find(([, roleText]) => hero.name.includes(roleText))?.[0] as
    | keyof typeof yuanliuzhiziRoleText
    | undefined;
}

export function App() {
  const [match, setMatch] = useState<MatchState>(() => createInitialMatch());
  const [teamAName, setTeamAName] = useState("蓝队");
  const [teamBName, setTeamBName] = useState("红队");
  const [firstSelector, setFirstSelector] = useState<TeamId>("teamA");
  const [heroes, setHeroes] = useState<HeroRecord[]>([]);
  const [heroLoadText, setHeroLoadText] = useState("正在载入本地英雄数据");
  const [notice, setNotice] = useState<{ text: string; kind: NoticeKind }>({
    text: "请先配置队伍名称与首局选边权。",
    kind: "info"
  });
  const [autosaveText, setAutosaveText] = useState("自动保存尚未开始");
  const [heroQuery, setHeroQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("全部");
  const [appVersion, setAppVersion] = useState("");
  const [peakDrafts, setPeakDrafts] = useState<Record<TeamId, PeakSlotDraft[]>>(() =>
    createPeakDrafts(createInitialMatch())
  );
  const [activePeakSlot, setActivePeakSlot] = useState<ActivePeakSlot>(null);
  const didLoadAutosave = useRef(false);

  const game = currentGame(match);
  const bpStep = game ? getCurrentBpStep(game) : undefined;
  const validation = useMemo(() => validateMatchState(match), [match]);

  const heroById = useMemo(() => new Map(heroes.map((hero) => [hero.id, hero])), [heroes]);
  const roles = useMemo(() => {
    const values = new Set<string>();
    heroes.forEach((hero) => hero.roles.forEach((role) => values.add(role)));
    return ["全部", ...Array.from(values)];
  }, [heroes]);
  const filteredHeroes = useMemo(() => {
    const normalizedQuery = heroQuery.trim().toLowerCase();

    return heroes.filter((hero) => {
      const matchRole = roleFilter === "全部" || hero.roles.includes(roleFilter);
      const matchQuery =
        !normalizedQuery ||
        hero.name.toLowerCase().includes(normalizedQuery) ||
        hero.title.toLowerCase().includes(normalizedQuery);

      return matchRole && matchQuery;
    });
  }, [heroQuery, heroes, roleFilter]);

  const newMatch = useCallback(() => {
    const nextMatch = createInitialMatch();
    setMatch(nextMatch);
    setTeamAName(nextMatch.teams.teamA.name);
    setTeamBName(nextMatch.teams.teamB.name);
    setFirstSelector("teamA");
    setPeakDrafts(createPeakDrafts(nextMatch));
    setActivePeakSlot(null);
    setNotice({ text: menuStatus["new-match"], kind: "success" });
  }, []);

  const openMatch = useCallback(async () => {
    const api = desktopApi();
    const result = api ? await api.openMatch() : await openMatchFile();
    const opened = handleFileDialogResult(result, setNotice);
    if (!opened) {
      return;
    }

    setMatch(opened);
    setTeamAName(opened.teams.teamA.name);
    setTeamBName(opened.teams.teamB.name);
    setPeakDrafts(createPeakDrafts(opened));
    setActivePeakSlot(null);
    setNotice({ text: menuStatus["open-match"], kind: "success" });
  }, []);

  const saveMatch = useCallback(async () => {
    const api = desktopApi();
    const result = api
      ? await api.saveMatch({
          matchState: match,
          defaultPath: createDefaultFileName(match, "match")
        })
      : downloadMatchFile(match, createDefaultFileName(match, "match"));
    handleWriteResult(result, menuStatus["save-match"], setNotice);
  }, [match]);

  const exportMatch = useCallback(async () => {
    const api = desktopApi();
    const result = api
      ? await api.exportMatch({
          matchState: match,
          defaultPath: createDefaultFileName(match, "export")
        })
      : downloadMatchFile(match, createDefaultFileName(match, "export"));
    handleWriteResult(result, menuStatus["export-match"], setNotice);
  }, [match]);

  useEffect(() => {
    const api = desktopApi();
    if (api) {
      void api.getAppVersion().then(setAppVersion);
    }

    void loadLocalHeroData()
      .then((data) => {
        const normalizedHeroes = normalizeHeroDataForBp(data.heroes);
        setHeroes(normalizedHeroes);
        setHeroLoadText(`本地英雄 ${normalizedHeroes.length} 个 BP 单位`);
      })
      .catch((error: unknown) => {
        setHeroLoadText("本地英雄数据载入失败");
        if (import.meta.env.DEV) {
          console.warn(error);
        }
      });
  }, []);

  useEffect(() => {
    const api = desktopApi();
    let disposed = false;

    const loadResult = api ? api.loadAutosave() : Promise.resolve(loadBrowserAutosave());

    void loadResult.then((result) => {
      if (disposed) {
        return;
      }

      didLoadAutosave.current = true;
      if (!result.ok) {
        setNotice({ text: result.error.message, kind: "error" });
        setAutosaveText(formatPersistenceError(result.error));
        return;
      }

      if (result.matchState) {
        setMatch(result.matchState);
        setTeamAName(result.matchState.teams.teamA.name);
        setTeamBName(result.matchState.teams.teamB.name);
        setPeakDrafts(createPeakDrafts(result.matchState));
        setNotice({ text: "已恢复自动存档。", kind: "success" });
        setAutosaveText(`已恢复${api ? "：" : "浏览器本地存储"}${api ? result.filePath : ""}`);
      } else {
        setAutosaveText(api ? "未发现自动存档" : "浏览器本地存储无存档");
      }
    });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!didLoadAutosave.current) {
      return undefined;
    }

    const api = desktopApi();
    const autosaveTimer = window.setTimeout(() => {
      if (api) {
        void api.autosaveMatch({ matchState: match }).then((result) => {
          if (!result.ok) {
            setAutosaveText(formatPersistenceError(result.error));
            return;
          }

          setAutosaveText(`自动保存完成：${new Date().toLocaleTimeString("zh-CN")}`);
        });
      } else {
        const result = saveBrowserAutosave(match);
        if (!result.ok) {
          setAutosaveText(formatPersistenceError(result.error));
          return;
        }

        setAutosaveText(`自动保存完成（浏览器）：${new Date().toLocaleTimeString("zh-CN")}`);
      }
    }, 400);

    return () => window.clearTimeout(autosaveTimer);
  }, [match]);

  useEffect(() => {
    const api = desktopApi();
    if (!api) {
      return undefined;
    }

    return api.onMenuCommand((command) => {
      if (command === "new-match") {
        newMatch();
      } else if (command === "open-match") {
        void openMatch();
      } else if (command === "save-match") {
        void saveMatch();
      } else {
        void exportMatch();
      }
    });
  }, [exportMatch, newMatch, openMatch, saveMatch]);

  function createConfiguredMatch() {
    const trimmedA = teamAName.trim() || "A队";
    const trimmedB = teamBName.trim() || "B队";
    const nextMatch = createMatch({
      teamAName: trimmedA,
      teamBName: trimmedB,
      teamAPlayers: defaultPlayers("teamA"),
      teamBPlayers: defaultPlayers("teamB"),
      firstSideSelectionTeam: firstSelector
    });

    setMatch(nextMatch);
    setPeakDrafts(createPeakDrafts(nextMatch));
    setActivePeakSlot(null);
    setNotice({ text: `${nextMatch.teams[firstSelector].name} 拥有第 1 局选边权。`, kind: "success" });
  }

  function applyMatchResult(result: RuleResult<MatchState>, successMessage: string) {
    if (result.ok) {
      setMatch(result.value);
      setNotice({ text: successMessage, kind: "success" });
      return;
    }

    setNotice({ text: formatRuleErrorMessage(result.error.message), kind: "error" });
  }

  function startGame(selectedSide: Side) {
    const selection = match.currentSideSelection;
    if (!selection) {
      setNotice({ text: "当前没有待处理的选边流程。", kind: "error" });
      return;
    }

    const nextGameIndex = match.games.length + 1;
    const isPeakDuel = nextGameIndex === 7 && match.score.teamA === 3 && match.score.teamB === 3;
    const result = isPeakDuel
      ? createPeakDuelGame(match, selection.teamId, selectedSide)
      : createGlobalBpGame(match, selection.teamId, selectedSide);

    if (result.ok && isPeakDuel) {
      setPeakDrafts(createPeakDrafts(result.value));
      setActivePeakSlot({ teamId: "teamA", slotIndex: 0 });
    }

    applyMatchResult(result, isPeakDuel ? "巅峰对决已创建，请双方盲选提交阵容。" : `第 ${nextGameIndex} 局 BP 已开始。`);
  }

  function handleHeroClick(heroId: number) {
    if (game?.mode === "peak_duel") {
      if (!activePeakSlot) {
        setNotice({ text: "请先选择一个巅峰对决阵容槽位。", kind: "error" });
        return;
      }

      if (game.peakDuel?.[activePeakSlot.teamId]) {
        setNotice({ text: "该队阵容已提交，不能继续编辑。", kind: "error" });
        return;
      }

      setPeakDrafts((current) => ({
        ...current,
        [activePeakSlot.teamId]: current[activePeakSlot.teamId].map((slot, index) =>
          index === activePeakSlot.slotIndex ? { ...slot, heroId } : slot
        )
      }));
      setNotice({
        text: `${match.teams[activePeakSlot.teamId].name} 第 ${activePeakSlot.slotIndex + 1} 位已选择英雄。`,
        kind: "success"
      });
      return;
    }

    if (!game || game.mode !== "global_bp" || !bpStep) {
      setNotice({ text: "当前没有可执行的 Ban/Pick 步骤。", kind: "error" });
      return;
    }

    applyMatchResult(bpStep.action === "ban" ? applyBan(match, heroId) : applyPick(match, heroId), "操作已记录。");
  }

  function selectWinner(winner: TeamId) {
    applyMatchResult(completeGame(match, winner), `${match.teams[winner].name} 获得本局胜利。`);
  }

  function updatePeakDraft(teamId: TeamId, slotIndex: number, patch: Partial<PeakSlotDraft>) {
    setPeakDrafts((current) => ({
      ...current,
      [teamId]: current[teamId].map((slot, index) => (index === slotIndex ? { ...slot, ...patch } : slot))
    }));
  }

  function submitPeakLineup(teamId: TeamId) {
    const lineup: PeakDuelLineup = {
      teamId,
      slots: peakDrafts[teamId].map((slot) => ({
        playerName: slot.playerName.trim(),
        heroId: slot.heroId ?? 0,
        summonerSkill: slot.summonerSkill
      })),
      submittedAt: new Date().toISOString()
    };

    const result = submitPeakDuelLineup(match, lineup);
    if (result.ok) {
      setActivePeakSlot(null);
    }
    applyMatchResult(result, `${match.teams[teamId].name} 已提交巅峰对决阵容。`);
  }

  const modeLabel = game?.mode === "peak_duel" ? "巅峰对决" : "全局 BP";
  const shouldPrioritizeHeroSelector = game?.mode === "global_bp" && match.status === "drafting";
  const displayScore = getDisplayScore(match, game);
  const heroSelector = (
    <HeroSelector
      heroes={filteredHeroes}
      totalCount={heroes.length}
      roles={roles}
      roleFilter={roleFilter}
      query={heroQuery}
      modeLabel={modeLabel}
      actionLabel={getHeroSelectorActionText(game, bpStep, activePeakSlot, match)}
      onRoleChange={setRoleFilter}
      onQueryChange={setHeroQuery}
      onHeroClick={handleHeroClick}
    />
  );

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand-lockup">
          <span>KPL BO7 BP Panel</span>
          <strong>KPL BO7 BP 模拟器</strong>
        </div>
        <div className="toolbar" aria-label="比赛操作">
          <button type="button" onClick={newMatch}>
            新建
          </button>
          <button type="button" onClick={() => void openMatch()}>
            打开
          </button>
          <button type="button" onClick={() => void saveMatch()} disabled={!validation.ok}>
            保存
          </button>
          <button type="button" onClick={() => void exportMatch()} disabled={!validation.ok}>
            导出
          </button>
        </div>
      </header>

      <section className="score-center" aria-label="比分与当前步骤">
        <ScoreWing tone="blue" label="蓝色方" match={match} game={game} />
        <article className="match-hub">
          <span>BO7 第 {match.games.length ? match.currentGameIndex : match.games.length + 1} 局</span>
          <strong>
            {displayScore.leftScore} : {displayScore.rightScore}
          </strong>
          <p>{getStepText(match, game, bpStep)}</p>
        </article>
        <ScoreWing tone="red" label="红色方" match={match} game={game} />
      </section>

      <section className="message-row" aria-live="polite">
        <div className={`message ${notice.kind}`}>{notice.text}</div>
        <div className="system-meta">
          <span>{heroLoadText}</span>
          <span>{autosaveText}</span>
          {appVersion ? <span>v{appVersion}</span> : null}
        </div>
      </section>

      <section className="draft-board" aria-label="BP 模拟主面板">
        <SidePanel side="blue" match={match} game={game} heroById={heroById} />

        <section className="control-column" aria-label="中心操作区">
          {shouldPrioritizeHeroSelector ? heroSelector : null}

          {match.status === "setup" ? (
            <MatchSetup
              teamAName={teamAName}
              teamBName={teamBName}
              firstSelector={firstSelector}
              onTeamANameChange={setTeamAName}
              onTeamBNameChange={setTeamBName}
              onFirstSelectorChange={setFirstSelector}
              onCreate={createConfiguredMatch}
            />
          ) : null}

          {match.currentSideSelection ? <SideSelectionPanel match={match} onSelectSide={startGame} /> : null}

          {game?.mode === "global_bp" ? (
            <GlobalBpPanel match={match} game={game} bpStep={bpStep} heroById={heroById} onWinner={selectWinner} />
          ) : null}

          {game?.mode === "peak_duel" ? (
            <PeakDuelPanel
              match={match}
              game={game}
              drafts={peakDrafts}
              heroById={heroById}
              activeSlot={activePeakSlot}
              onActivateSlot={setActivePeakSlot}
              onDraftChange={updatePeakDraft}
              onSubmit={submitPeakLineup}
              onWinner={selectWinner}
            />
          ) : null}

          {match.status === "match_complete" ? <MatchSummary match={match} heroById={heroById} /> : null}

          {shouldPrioritizeHeroSelector ? null : heroSelector}
        </section>

        <SidePanel side="red" match={match} game={game} heroById={heroById} />
      </section>

      <GameHistory match={match} heroById={heroById} />
    </main>
  );
}

function ScoreWing({ tone, label, match, game }: { tone: Side; label: string; match: MatchState; game?: GameState }) {
  const teamId = game ? getTeamForSide(game, tone) : tone === "blue" ? "teamA" : "teamB";

  return (
    <article className={`score-wing ${tone}`}>
      <span>{label}</span>
      <strong title={match.teams[teamId].name}>{match.teams[teamId].name}</strong>
      <b>{match.score[teamId]}</b>
    </article>
  );
}

function MatchSetup({
  teamAName,
  teamBName,
  firstSelector,
  onTeamANameChange,
  onTeamBNameChange,
  onFirstSelectorChange,
  onCreate
}: {
  teamAName: string;
  teamBName: string;
  firstSelector: TeamId;
  onTeamANameChange: (value: string) => void;
  onTeamBNameChange: (value: string) => void;
  onFirstSelectorChange: (teamId: TeamId) => void;
  onCreate: () => void;
}) {
  return (
    <section className="panel-section">
      <div className="section-heading">
        <span>比赛设置</span>
        <strong>创建 BO7 对局</strong>
      </div>
      <label className="field">
        <span>A 队名称</span>
        <input value={teamAName} onChange={(event) => onTeamANameChange(event.target.value)} />
      </label>
      <label className="field">
        <span>B 队名称</span>
        <input value={teamBName} onChange={(event) => onTeamBNameChange(event.target.value)} />
      </label>
      <div className="segmented" role="radiogroup" aria-label="首局选边权">
        {TEAMS.map((teamId) => (
          <button
            className={firstSelector === teamId ? "selected" : ""}
            key={teamId}
            type="button"
            onClick={() => onFirstSelectorChange(teamId)}
          >
            {teamId === "teamA" ? "A 队首选" : "B 队首选"}
          </button>
        ))}
      </div>
      <button className="primary-action" type="button" onClick={onCreate}>
        创建比赛
      </button>
    </section>
  );
}

function SideSelectionPanel({ match, onSelectSide }: { match: MatchState; onSelectSide: (side: Side) => void }) {
  const selection = match.currentSideSelection;
  if (!selection) {
    return null;
  }

  return (
    <section className="panel-section accent-section">
      <div className="section-heading">
        <span>选边</span>
        <strong>第 {selection.gameIndex} 局选边权</strong>
      </div>
      <p className="compact-copy">
        {match.teams[selection.teamId].name}
        {selection.reason === "initial" ? " 拥有首局选边权。" : " 作为上一局败方选择边。"}
      </p>
      <div className="side-choice">
        {SIDES.map((side) => (
          <button className={side} type="button" key={side} onClick={() => onSelectSide(side)}>
            选择{sideText[side]}
          </button>
        ))}
      </div>
    </section>
  );
}

function GlobalBpPanel({
  match,
  game,
  bpStep,
  heroById,
  onWinner
}: {
  match: MatchState;
  game: GameState;
  bpStep?: BpStep;
  heroById: Map<number, HeroRecord>;
  onWinner: (winner: TeamId) => void;
}) {
  const finished = isGlobalBpComplete(game);

  return (
    <section className="panel-section">
      <div className="section-heading">
        <span>第 {game.index} 局</span>
        <strong>{finished ? "选择本局胜者" : "全局 BP 进行中"}</strong>
      </div>
      {bpStep ? (
        <div className={`current-step ${bpStep.side}`}>
          <span>{sideText[bpStep.side]}</span>
          <strong>{actionText[bpStep.action]}</strong>
          <small>{match.teams[getTeamForSide(game, bpStep.side)].name}</small>
        </div>
      ) : null}
      {finished ? <WinnerButtons match={match} game={game} onWinner={onWinner} /> : <BpTimeline game={game} />}
      <MiniDraftPreview game={game} heroById={heroById} />
    </section>
  );
}

function PeakDuelPanel({
  match,
  game,
  drafts,
  heroById,
  activeSlot,
  onActivateSlot,
  onDraftChange,
  onSubmit,
  onWinner
}: {
  match: MatchState;
  game: GameState;
  drafts: Record<TeamId, PeakSlotDraft[]>;
  heroById: Map<number, HeroRecord>;
  activeSlot: ActivePeakSlot;
  onActivateSlot: (slot: ActivePeakSlot) => void;
  onDraftChange: (teamId: TeamId, slotIndex: number, patch: Partial<PeakSlotDraft>) => void;
  onSubmit: (teamId: TeamId) => void;
  onWinner: (winner: TeamId) => void;
}) {
  const bothSubmitted = Boolean(game.peakDuel?.teamA && game.peakDuel?.teamB);

  return (
    <section className="panel-section peak-section">
      <div className="section-heading">
        <span>第 7 局</span>
        <strong>{bothSubmitted ? "巅峰对决阵容揭晓" : "巅峰对决盲选提交"}</strong>
      </div>
      <div className="peak-grid">
        {TEAMS.map((teamId) => (
          <PeakTeamEditor
            key={teamId}
            teamId={teamId}
            match={match}
            game={game}
            slots={drafts[teamId]}
            heroById={heroById}
            activeSlot={activeSlot}
            onActivateSlot={onActivateSlot}
            onDraftChange={onDraftChange}
            onSubmit={onSubmit}
          />
        ))}
      </div>
      {bothSubmitted ? <WinnerButtons match={match} game={game} onWinner={onWinner} /> : null}
    </section>
  );
}

function PeakTeamEditor({
  teamId,
  match,
  game,
  slots,
  heroById,
  activeSlot,
  onActivateSlot,
  onDraftChange,
  onSubmit
}: {
  teamId: TeamId;
  match: MatchState;
  game: GameState;
  slots: PeakSlotDraft[];
  heroById: Map<number, HeroRecord>;
  activeSlot: ActivePeakSlot;
  onActivateSlot: (slot: ActivePeakSlot) => void;
  onDraftChange: (teamId: TeamId, slotIndex: number, patch: Partial<PeakSlotDraft>) => void;
  onSubmit: (teamId: TeamId) => void;
}) {
  const submitted = game.peakDuel?.[teamId];
  const side = getSideForTeam(game, teamId);

  return (
    <article className={`peak-team ${side}`}>
      <div className="peak-team-title">
        <span>{sideText[side]}</span>
        <strong title={match.teams[teamId].name}>{match.teams[teamId].name}</strong>
        <b>{submitted ? "已提交" : "编辑中"}</b>
      </div>
      {submitted ? (
        <SubmittedLineup lineup={submitted} heroById={heroById} reveal={Boolean(game.peakDuel?.teamA && game.peakDuel?.teamB)} />
      ) : (
        <>
          <div className="peak-slots">
            {slots.map((slot, index) => {
              const hero = slot.heroId ? heroById.get(slot.heroId) : undefined;
              const active = activeSlot?.teamId === teamId && activeSlot.slotIndex === index;

              return (
                <button
                  className={`peak-slot ${active ? "active" : ""}`}
                  key={`${teamId}-${index}`}
                  type="button"
                  onClick={() => onActivateSlot({ teamId, slotIndex: index })}
                >
                  <span>{PLAYER_ROLES[index]}</span>
                  <strong>{hero?.name ?? "选择英雄"}</strong>
                  {hero ? <img alt="" src={hero.iconUrl} /> : null}
                </button>
              );
            })}
          </div>
          <div className="lineup-form">
            {slots.map((slot, index) => (
              <div className="lineup-row" key={`${teamId}-form-${index}`}>
                <input
                  aria-label={`${PLAYER_ROLES[index]}选手`}
                  value={slot.playerName}
                  onChange={(event) => onDraftChange(teamId, index, { playerName: event.target.value })}
                />
                <select
                  aria-label={`${PLAYER_ROLES[index]}召唤师技能`}
                  value={slot.summonerSkill}
                  onChange={(event) => onDraftChange(teamId, index, { summonerSkill: event.target.value })}
                >
                  {SUMMONER_SKILLS.map((skill) => (
                    <option key={skill}>{skill}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button className="primary-action" type="button" onClick={() => onSubmit(teamId)}>
            提交{match.teams[teamId].name}阵容
          </button>
        </>
      )}
    </article>
  );
}

function SubmittedLineup({
  lineup,
  heroById,
  reveal
}: {
  lineup: PeakDuelLineup;
  heroById: Map<number, HeroRecord>;
  reveal: boolean;
}) {
  if (!reveal) {
    return <div className="blind-lock">阵容已锁定，等待双方同时揭晓。</div>;
  }

  return (
    <div className="submitted-lineup">
      {lineup.slots.map((slot, index) => {
        const hero = heroById.get(slot.heroId);
        return (
          <div className="submitted-row" key={`${lineup.teamId}-${slot.heroId}-${index}`}>
            <img alt="" src={hero?.iconUrl} />
            <span>{slot.playerName || PLAYER_ROLES[index]}</span>
            <strong>{hero?.name ?? `英雄 ${slot.heroId}`}</strong>
            <b>{slot.summonerSkill || "未填"}</b>
          </div>
        );
      })}
    </div>
  );
}

function WinnerButtons({ match, game, onWinner }: { match: MatchState; game: GameState; onWinner: (winner: TeamId) => void }) {
  return (
    <div className="winner-actions">
      {TEAMS.map((teamId) => (
        <button className={getSideForTeam(game, teamId)} key={teamId} type="button" onClick={() => onWinner(teamId)}>
          {match.teams[teamId].name} 胜
        </button>
      ))}
    </div>
  );
}

function SidePanel({
  side,
  match,
  game,
  heroById
}: {
  side: Side;
  match: MatchState;
  game?: GameState;
  heroById: Map<number, HeroRecord>;
}) {
  const teamId = game ? getTeamForSide(game, side) : side === "blue" ? "teamA" : "teamB";
  const bans = game?.bans[side] ?? [];
  const picks = game?.picks[side] ?? [];

  return (
    <section className={`side-panel ${side}`} aria-label={sideText[side]}>
      <div className="side-header">
        <span>{sideText[side]}</span>
        <strong title={match.teams[teamId].name}>{match.teams[teamId].name}</strong>
      </div>
      <SlotGroup title="本局 Ban 位" count={NORMAL_BAN_SLOT_COUNT} heroIds={bans} heroById={heroById} kind="ban" />
      <SlotGroup title="本局 Pick 位" count={NORMAL_PICK_SLOT_COUNT} heroIds={picks} heroById={heroById} kind="pick" />
      <UsedHeroPool heroIds={match.teams[teamId].usedHeroIds} heroById={heroById} />
    </section>
  );
}

function SlotGroup({
  title,
  count,
  heroIds,
  heroById,
  kind
}: {
  title: string;
  count: number;
  heroIds: number[];
  heroById: Map<number, HeroRecord>;
  kind: "ban" | "pick";
}) {
  const slots = Array.from({ length: count }, (_, index) => heroIds[index]);

  return (
    <div className="slot-group">
      <h2>{title}</h2>
      <div className={`slot-grid ${kind === "ban" ? "ban-grid" : "pick-grid"}`}>
        {slots.map((heroId, index) => (
          <HeroSlot key={`${kind}-${index}`} hero={heroId ? heroById.get(heroId) : undefined} fallback={`空位 ${index + 1}`} kind={kind} />
        ))}
      </div>
    </div>
  );
}

function HeroSlot({ hero, fallback, kind }: { hero?: HeroRecord; fallback: string; kind: "ban" | "pick" }) {
  return (
    <div className={`hero-slot ${kind} ${hero ? "filled" : ""}`}>
      {hero ? (
        <>
          <img alt="" src={hero.iconUrl} />
          <span title={hero.name}>{hero.name}</span>
        </>
      ) : (
        <span>{fallback}</span>
      )}
    </div>
  );
}

function UsedHeroPool({ heroIds, heroById }: { heroIds: number[]; heroById: Map<number, HeroRecord> }) {
  return (
    <div className="used-pool">
      <div className="pool-header">
        <h2>全局已用英雄池</h2>
        <span>{heroIds.length}</span>
      </div>
      {heroIds.length ? (
        <div className="used-icons">
          {heroIds.map((heroId) => {
            const hero = heroById.get(heroId);
            return (
              <div className="used-chip" key={heroId} title={hero?.name ?? `英雄 ${heroId}`}>
                {hero ? <img alt="" src={hero.iconUrl} /> : null}
                <span>{hero?.name ?? heroId}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p>暂无已用英雄</p>
      )}
    </div>
  );
}

function HeroSelector({
  heroes,
  totalCount,
  roles,
  roleFilter,
  query,
  modeLabel,
  actionLabel,
  onRoleChange,
  onQueryChange,
  onHeroClick
}: {
  heroes: HeroRecord[];
  totalCount: number;
  roles: string[];
  roleFilter: string;
  query: string;
  modeLabel: string;
  actionLabel: string;
  onRoleChange: (role: string) => void;
  onQueryChange: (query: string) => void;
  onHeroClick: (heroId: number) => void;
}) {
  return (
    <section className="hero-selector">
      <div className="selector-head">
        <div>
          <span>{modeLabel}</span>
          <strong>{actionLabel}</strong>
        </div>
        <b>
          {heroes.length}/{totalCount}
        </b>
      </div>
      <div className="selector-tools">
        <input placeholder="搜索英雄" value={query} onChange={(event) => onQueryChange(event.target.value)} />
        <select value={roleFilter} onChange={(event) => onRoleChange(event.target.value)}>
          {roles.map((role) => (
            <option key={role}>{role}</option>
          ))}
        </select>
      </div>
      <div className="hero-grid">
        {heroes.map((hero) => (
          <button className="hero-card" key={hero.id} type="button" onClick={() => onHeroClick(hero.id)}>
            <img alt="" src={hero.iconUrl} />
            <span title={hero.name}>{hero.name}</span>
            <small title={hero.roles.join(" / ")}>{hero.roles.join(" / ")}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function BpTimeline({ game }: { game: GameState }) {
  return (
    <ol className="bp-timeline">
      {SIDES.flatMap((side) => [
        <li key={`${side}-ban`} className={game.bans[side].length === NORMAL_BAN_SLOT_COUNT ? "done" : ""}>
          {sideText[side]} Ban {game.bans[side].length}/{NORMAL_BAN_SLOT_COUNT}
        </li>,
        <li key={`${side}-pick`} className={game.picks[side].length === NORMAL_PICK_SLOT_COUNT ? "done" : ""}>
          {sideText[side]} Pick {game.picks[side].length}/{NORMAL_PICK_SLOT_COUNT}
        </li>
      ])}
    </ol>
  );
}

function MiniDraftPreview({ game, heroById }: { game: GameState; heroById: Map<number, HeroRecord> }) {
  return (
    <div className="mini-preview">
      {SIDES.map((side) => (
        <div key={side}>
          <span>{sideText[side]}</span>
          <p>
            {game.picks[side].length
              ? game.picks[side].map((heroId) => heroById.get(heroId)?.name ?? heroId).join(" / ")
              : "暂无选用"}
          </p>
        </div>
      ))}
    </div>
  );
}

function MatchSummary({ match, heroById }: { match: MatchState; heroById: Map<number, HeroRecord> }) {
  const winner = match.score.teamA === 4 ? "teamA" : "teamB";

  return (
    <section className="panel-section summary-section">
      <div className="section-heading">
        <span>比赛结束</span>
        <strong>{match.teams[winner].name} 获胜</strong>
      </div>
      <div className="final-score">
        <span>{match.teams.teamA.name}</span>
        <b>
          {match.score.teamA} : {match.score.teamB}
        </b>
        <span>{match.teams.teamB.name}</span>
      </div>
      <div className="summary-games">
        {match.games.map((game) => (
          <div className="summary-game" key={game.index}>
            <span>G{game.index}</span>
            <strong>{game.winner ? match.teams[game.winner].name : "未完成"}</strong>
            <small>{game.mode === "peak_duel" ? "巅峰对决" : "全局 BP"}</small>
          </div>
        ))}
      </div>
      <MiniUsedSummary match={match} heroById={heroById} />
    </section>
  );
}

function MiniUsedSummary({ match, heroById }: { match: MatchState; heroById: Map<number, HeroRecord> }) {
  return (
    <div className="mini-used-summary">
      {TEAMS.map((teamId) => (
        <div key={teamId}>
          <span>{match.teams[teamId].name}</span>
          <p>{match.teams[teamId].usedHeroIds.map((heroId) => heroById.get(heroId)?.name ?? heroId).join(" / ") || "无"}</p>
        </div>
      ))}
    </div>
  );
}

function GameHistory({ match, heroById }: { match: MatchState; heroById: Map<number, HeroRecord> }) {
  if (!match.games.length) {
    return null;
  }

  return (
    <section className="game-history" aria-label="小局记录">
      {match.games.map((game) => (
        <article key={game.index} className={game.mode === "peak_duel" ? "peak" : ""}>
          <span>G{game.index}</span>
          <strong>{game.winner ? `${match.teams[game.winner].name} 胜` : game.mode === "peak_duel" ? "巅峰对决" : "BP 中"}</strong>
          <p>
            蓝 {game.picks.blue.map((heroId) => heroById.get(heroId)?.name ?? heroId).join(" / ") || "未选"} · 红{" "}
            {game.picks.red.map((heroId) => heroById.get(heroId)?.name ?? heroId).join(" / ") || "未选"}
          </p>
        </article>
      ))}
    </section>
  );
}

function getStepText(match: MatchState, game?: GameState, bpStep?: BpStep): string {
  if (match.status === "match_complete") {
    const winner = match.score.teamA === 4 ? match.teams.teamA.name : match.teams.teamB.name;
    return `比赛结束：${winner} 获胜`;
  }

  if (match.currentSideSelection) {
    return `第 ${match.currentSideSelection.gameIndex} 局选边：${match.teams[match.currentSideSelection.teamId].name}`;
  }

  if (!game) {
    return "等待创建比赛";
  }

  if (game.mode === "peak_duel") {
    const submitted = TEAMS.filter((teamId) => game.peakDuel?.[teamId]).length;
    return submitted === 2 ? "巅峰对决阵容已揭晓，选择胜者" : `巅峰对决盲选提交 ${submitted}/2`;
  }

  if (bpStep) {
    return `${sideText[bpStep.side]} ${actionText[bpStep.action]}：${match.teams[getTeamForSide(game, bpStep.side)].name}`;
  }

  return "本局 BP 完成，请选择胜者";
}

function getHeroSelectorActionText(
  game: GameState | undefined,
  bpStep: BpStep | undefined,
  activePeakSlot: ActivePeakSlot,
  match: MatchState
): string {
  if (game?.mode === "peak_duel") {
    if (!activePeakSlot) {
      return "选择阵容槽位后点选英雄";
    }

    return `${match.teams[activePeakSlot.teamId].name} 第 ${activePeakSlot.slotIndex + 1} 位选英雄`;
  }

  if (!bpStep || !game) {
    return "当前无可执行英雄操作";
  }

  return `${sideText[bpStep.side]} ${actionText[bpStep.action]}`;
}

function handleFileDialogResult(
  result: FileDialogResult,
  setNotice: (notice: { text: string; kind: NoticeKind }) => void
): MatchState | null {
  if (result.canceled) {
    return null;
  }

  if (!result.ok) {
    setNotice({ text: formatPersistenceError(result.error), kind: "error" });
    return null;
  }

  if (!result.matchState) {
    setNotice({ text: "文件打开成功但没有返回比赛数据。", kind: "error" });
    return null;
  }

  return result.matchState;
}

function handleWriteResult(
  result: FileDialogResult,
  successMessage: string,
  setNotice: (notice: { text: string; kind: NoticeKind }) => void
): void {
  if (result.canceled) {
    return;
  }

  if (!result.ok) {
    setNotice({ text: formatPersistenceError(result.error), kind: "error" });
    return;
  }

  setNotice({ text: `${successMessage} ${result.filePath}`, kind: "success" });
}

function createDefaultFileName(match: MatchState, suffix: "match" | "export"): string {
  const safeTeamA = sanitizeFileSegment(match.teams.teamA.name);
  const safeTeamB = sanitizeFileSegment(match.teams.teamB.name);
  const date = new Date().toISOString().slice(0, 10);
  return `${safeTeamA}-vs-${safeTeamB}-${suffix}-${date}.json`;
}

function sanitizeFileSegment(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, "-") || "kpl";
}

function formatPersistenceError(error: PersistenceError): string {
  const details = error.details?.reason ? `（${String(error.details.reason)}）` : "";
  return `${error.message}${details}`;
}

function formatRuleErrorMessage(message: string): string {
  return message.includes("元流之子") ? `元流之子规则：${message}` : message;
}
