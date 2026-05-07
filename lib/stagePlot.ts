export type StageItemVariant = "circle" | "backline" | "split-backline";
export type DefaultStageItemTemplateId = "marshall" | "jc" | "active-passive";

export type StaticStageMarkerKind = "main" | "monitor";

export type StaticStageMarker = {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: StaticStageMarkerKind;
};

export type DefaultStageItemTemplate = {
  templateId: DefaultStageItemTemplateId;
  label: string;
  dashed: boolean;
  x: number;
  y: number;
  variant?: StageItemVariant;
};

type StageItemLike = {
  id: string;
  label: string;
  dashed?: boolean;
  x: number;
  y: number;
  variant?: StageItemVariant;
  templateId?: DefaultStageItemTemplateId;
};

export type StagePlotMemberPosition = {
  x: number;
  y: number;
};

export type StagePlotMemberPositionMap = Record<string, StagePlotMemberPosition>;

export type StagePlotLike<TItem extends StageItemLike = StageItemLike> = {
  id: string;
  name: string;
  items: TItem[];
  memberPositions?: StagePlotMemberPositionMap;
};

export type StagePlotSongAssignmentMap = Record<string, string>;

export type StagePlotDataReadResult<TItem extends StageItemLike = StageItemLike> = {
  plots: StagePlotLike<TItem>[];
  songPlotAssignments: StagePlotSongAssignmentMap;
};

export const STATIC_STAGE_MARKERS: StaticStageMarker[] = [
  { id: "main-l", label: "MAIN L", x: 21, y: 81, kind: "main" },
  { id: "main-r", label: "MAIN R", x: 79, y: 81, kind: "main" },
  { id: "mon-1", label: "MON1", x: 14, y: 62, kind: "monitor" },
  { id: "mon-3", label: "MON3", x: 62, y: 13, kind: "monitor" },
  { id: "mon-2", label: "MON2", x: 50, y: 87, kind: "monitor" },
  { id: "mon-4", label: "MON4", x: 86, y: 62, kind: "monitor" },
];

export const DEFAULT_STAGE_ITEM_TEMPLATES: DefaultStageItemTemplate[] = [
  { templateId: "marshall", label: "Marshall", dashed: true, x: 74, y: 34, variant: "backline" },
  { templateId: "jc", label: "JC", dashed: true, x: 62, y: 34, variant: "backline" },
  {
    templateId: "active-passive",
    label: "Active / Passive",
    dashed: true,
    x: 29.5,
    y: 34,
    variant: "split-backline",
  },
];

export const createDefaultStageItems = (createId: () => string) =>
  DEFAULT_STAGE_ITEM_TEMPLATES.map((item) => ({
    id: createId(),
    ...item,
  }));

export const createDefaultStagePlot = <TItem extends StageItemLike = StageItemLike>(
  createId: () => string,
  index = 0
) =>
  ({
    id: createId(),
    name: `配置図${index + 1}`,
    items: createDefaultStageItems(createId) as TItem[],
    memberPositions: {},
  }) satisfies StagePlotLike<TItem>;

export const createDefaultStagePlots = <TItem extends StageItemLike = StageItemLike>(
  createId: () => string
) => [createDefaultStagePlot<TItem>(createId, 0)];

const normalizeStageItemLabel = (label: string) => label.trim().toLowerCase();
const clampPercent = (value: number) => Math.min(95, Math.max(5, value));

export const normalizeStageItemsWithTemplateIds = <T extends StageItemLike>(items: T[]): T[] => {
  const nextItems = items.map((item) => ({ ...item }));
  const claimedIndexes = new Set<number>();
  const usedTemplateIds = new Set<DefaultStageItemTemplateId>();

  const assignTemplate = (index: number, templateId: DefaultStageItemTemplateId) => {
    if (claimedIndexes.has(index) || usedTemplateIds.has(templateId)) return;
    nextItems[index].templateId = templateId;
    claimedIndexes.add(index);
    usedTemplateIds.add(templateId);
  };

  nextItems.forEach((item, index) => {
    if (!item.templateId) return;
    assignTemplate(index, item.templateId);
  });

  DEFAULT_STAGE_ITEM_TEMPLATES.forEach((template) => {
    const index = nextItems.findIndex(
      (item, itemIndex) =>
        !claimedIndexes.has(itemIndex) &&
        normalizeStageItemLabel(item.label) === normalizeStageItemLabel(template.label)
    );
    if (index >= 0) {
      assignTemplate(index, template.templateId);
    }
  });

  const splitIndex = nextItems.findIndex(
    (item, index) => !claimedIndexes.has(index) && item.variant === "split-backline"
  );
  if (splitIndex >= 0) {
    assignTemplate(splitIndex, "active-passive");
  }

  const remainingBacklineIndexes = nextItems
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => !claimedIndexes.has(index) && item.variant === "backline")
    .sort((left, right) => right.item.x - left.item.x)
    .map(({ index }) => index);

  if (remainingBacklineIndexes[0] != null) {
    assignTemplate(remainingBacklineIndexes[0], "marshall");
  }
  if (remainingBacklineIndexes[1] != null) {
    assignTemplate(remainingBacklineIndexes[1], "jc");
  }

  return nextItems;
};

const normalizeStageMemberPositions = (raw: unknown): StagePlotMemberPositionMap => {
  if (!raw || typeof raw !== "object") return {};

  return Object.fromEntries(
    Object.entries(raw).flatMap(([memberId, value]) => {
      if (!value || typeof value !== "object") return [];
      const entry = value as Partial<StagePlotMemberPosition>;
      const x = Number(entry.x);
      const y = Number(entry.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
      return [[memberId, { x: clampPercent(x), y: clampPercent(y) }]];
    })
  );
};

export const normalizeStagePlotsWithTemplateIds = <TItem extends StageItemLike>(
  plots: Array<Partial<StagePlotLike<TItem>>> | null | undefined,
  createId: () => string
): StagePlotLike<TItem>[] => {
  if (!Array.isArray(plots) || plots.length === 0) {
    return createDefaultStagePlots<TItem>(createId);
  }

  return plots.map((plot, index) => ({
    id: typeof plot.id === "string" && plot.id.trim() ? plot.id : createId(),
    name: typeof plot.name === "string" && plot.name.trim() ? plot.name.trim() : `配置図${index + 1}`,
    items: normalizeStageItemsWithTemplateIds(Array.isArray(plot.items) ? plot.items : []),
    memberPositions: normalizeStageMemberPositions(plot.memberPositions),
  }));
};

const createCounterId = (prefix: string) => {
  let nextId = 1;
  return () => `${prefix}-${nextId++}`;
};

const parseStageItemsFromUnknown = (raw: unknown, createId: () => string) => {
  const parsedItems = (Array.isArray(raw) ? raw : [])
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Partial<StageItemLike>;
      const label = typeof entry.label === "string" ? entry.label.trim() : "";
      if (!label) return null;

      const x = Number(entry.x ?? 50);
      const y = Number(entry.y ?? 50);

      return {
        id: typeof entry.id === "string" && entry.id.trim() ? entry.id : createId(),
        label,
        dashed: Boolean(entry.dashed),
        x: clampPercent(Number.isFinite(x) ? x : 50),
        y: clampPercent(Number.isFinite(y) ? y : 50),
        variant: entry.variant,
        templateId: entry.templateId,
      } satisfies StageItemLike;
    })
    .filter((item) => item !== null) as StageItemLike[];

  return normalizeStageItemsWithTemplateIds(parsedItems);
};

const normalizeSongPlotAssignments = (raw: unknown): StagePlotSongAssignmentMap => {
  if (!raw || typeof raw !== "object") return {};

  return Object.fromEntries(
    Object.entries(raw).flatMap(([key, value]) => {
      if (typeof value !== "string" || !value.trim()) return [];
      return [[key, value.trim()]];
    })
  );
};

export const readStagePlotData = <TItem extends StageItemLike = StageItemLike>(
  value: Record<string, unknown> | null | undefined
): StagePlotDataReadResult<TItem> => {
  const rawData = value as
    | {
        items?: unknown;
        plots?: unknown;
        allowEmpty?: unknown;
        songPlotAssignments?: unknown;
        memberPositions?: unknown;
      }
    | null
    | undefined;
  const createPlotId = createCounterId("stage-plot");
  const createItemId = createCounterId("stage-item");
  const createDefaultId = createCounterId("stage-default");
  const allowEmpty = rawData?.allowEmpty === true;

  let plots: StagePlotLike<TItem>[];

  if (Array.isArray(rawData?.plots)) {
    const parsedPlots = rawData.plots.map((plot, index) => {
      const entry =
        plot && typeof plot === "object"
          ? (plot as {
              id?: string;
              name?: string;
              items?: unknown;
              memberPositions?: unknown;
            })
          : null;

      return {
        id: typeof entry?.id === "string" && entry.id.trim() ? entry.id.trim() : createPlotId(),
        name:
          typeof entry?.name === "string" && entry.name.trim()
            ? entry.name.trim()
            : `配置図${index + 1}`,
        items: parseStageItemsFromUnknown(entry?.items, createItemId) as TItem[],
        memberPositions: normalizeStageMemberPositions(entry?.memberPositions),
      } satisfies StagePlotLike<TItem>;
    });

    plots =
      parsedPlots.length > 0
        ? parsedPlots
        : [{ id: createPlotId(), name: "配置図1", items: [] as TItem[], memberPositions: {} }];
  } else if (Array.isArray(rawData?.items)) {
    const items = parseStageItemsFromUnknown(rawData.items, createItemId) as TItem[];
    plots =
      items.length > 0 || allowEmpty
        ? [
            {
              id: createPlotId(),
              name: "配置図1",
              items,
              memberPositions: normalizeStageMemberPositions(rawData?.memberPositions),
            },
          ]
        : createDefaultStagePlots<TItem>(createDefaultId);
  } else {
    plots = createDefaultStagePlots<TItem>(createDefaultId);
  }

  return {
    plots,
    songPlotAssignments: normalizeSongPlotAssignments(rawData?.songPlotAssignments),
  };
};

export const applyStagePlotAssignments = <TSong extends { order_index: number | null }>(
  songs: TSong[],
  plots: Array<Pick<StagePlotLike, "id">>,
  songPlotAssignments: StagePlotSongAssignmentMap
): Array<TSong & { stagePlotId: string | null }> => {
  const defaultPlotId = plots[0]?.id ?? null;
  const validPlotIds = new Set(plots.map((plot) => plot.id));

  return songs.map((song, index) => {
    const assignmentKey = String(song.order_index ?? index + 1);
    const assignedPlotId = songPlotAssignments[assignmentKey];

    return {
      ...song,
      stagePlotId: validPlotIds.has(assignedPlotId) ? assignedPlotId : defaultPlotId,
    };
  });
};

export const applyStagePlotMemberPositions = <
  TMember extends { id: string; x: number; y: number }
>(
  members: TMember[],
  memberPositions?: StagePlotMemberPositionMap | null
) => {
  if (!memberPositions || Object.keys(memberPositions).length === 0) {
    return members.map((member) => ({ ...member }));
  }

  return members.map((member) => {
    const position = memberPositions[member.id];
    return position ? { ...member, x: position.x, y: position.y } : { ...member };
  });
};

export const extractStagePlotMemberPositions = <
  TMember extends { id: string; x: number; y: number }
>(
  members: TMember[]
): StagePlotMemberPositionMap =>
  Object.fromEntries(
    members.map((member) => [
      member.id,
      {
        x: clampPercent(member.x),
        y: clampPercent(member.y),
      },
    ])
  );

export const splitStageItemLabel = (label: string) =>
  label
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
