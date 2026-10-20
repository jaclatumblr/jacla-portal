export type LayoutAlign = "left" | "center" | "right";

export type LayoutTextField = {
  x: number;
  y: number;
  maxWidth: number;
  size: number;
  align?: LayoutAlign;
};

export type LayoutSetPlot = {
  x: number;
  y: number;
  width: number;
  height: number;
  maxPoints: number;
  pointSize: number;
  drawLabels: boolean;
  invertY: boolean;
};

export type CustomLayerType = "text" | "rect" | "circle";

export type CustomLayer = {
  id: string;
  name: string;
  type: CustomLayerType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  size?: number;
  text?: string;
  color?: string;
  visible: boolean;
  locked: boolean;
};

export type VoxSetlistLayout = {
  showEventName: boolean;
  fields: {
    eventName: LayoutTextField;
    eventDate: LayoutTextField;
    bandName: LayoutTextField;
    pageLabel: LayoutTextField;
    setOrder: LayoutTextField;
    totalDuration: LayoutTextField; // Legacy storage key: planned start time.
    plannedStartTime: LayoutTextField; // Legacy storage key: planned end time.
  };
  notes: {
    lighting: LayoutTextField;
    pa: LayoutTextField;
    stageSummary: LayoutTextField;
  };
  setPlot: LayoutSetPlot;
  customLayers: CustomLayer[];
};

export const defaultVoxSetlistLayout: VoxSetlistLayout = {
  showEventName: false,
  fields: {
    eventName: { x: 74, y: 783, maxWidth: 300, size: 10, align: "left" },
    eventDate: { x: 377, y: 801, maxWidth: 145, size: 9, align: "right" },
    bandName: { x: 88, y: 704, maxWidth: 470, size: 12, align: "center" },
    pageLabel: { x: 505, y: 686, maxWidth: 52, size: 9, align: "center" },
    setOrder: { x: 31, y: 704, maxWidth: 52, size: 11, align: "center" },
    totalDuration: { x: 290, y: 670, maxWidth: 90, size: 10, align: "center" },
    plannedStartTime: { x: 440, y: 670, maxWidth: 100, size: 10, align: "center" },
  },
  notes: {
    lighting: { x: 204, y: 160, maxWidth: 158, size: 7, align: "left" },
    pa: { x: 366, y: 160, maxWidth: 135, size: 7, align: "left" },
    stageSummary: { x: 204, y: 136, maxWidth: 158, size: 7, align: "left" },
  },
  setPlot: {
    x: 31,
    y: 500,
    width: 334,
    height: 136,
    maxPoints: 24,
    pointSize: 3.2,
    drawLabels: true,
    invertY: true,
  },
  customLayers: [],
};

const asNumber = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const asBool = (v: unknown, fallback: boolean) =>
  typeof v === "boolean" ? v : fallback;

const asString = (v: unknown, fallback: string) =>
  typeof v === "string" ? v : fallback;

const normalizeCustomLayer = (raw: unknown): CustomLayer | null => {
  const r = (raw ?? {}) as Partial<CustomLayer>;
  const type = r.type === "rect" || r.type === "circle" || r.type === "text" ? r.type : null;
  if (!type) return null;

  return {
    id: asString(r.id, `layer-${Math.random().toString(36).slice(2, 9)}`),
    name: asString(r.name, `${type}-layer`),
    type,
    x: asNumber(r.x, 100),
    y: asNumber(r.y, 100),
    width: asNumber(r.width, 80),
    height: asNumber(r.height, 24),
    radius: asNumber(r.radius, 8),
    size: asNumber(r.size, 10),
    text: asString(r.text, "text"),
    color: asString(r.color, "#000000"),
    visible: asBool(r.visible, true),
    locked: asBool(r.locked, false),
  };
};

const mergeTextField = (base: LayoutTextField, raw: unknown): LayoutTextField => {
  const r = (raw ?? {}) as Partial<LayoutTextField>;
  return {
    x: asNumber(r.x, base.x),
    y: asNumber(r.y, base.y),
    maxWidth: asNumber(r.maxWidth, base.maxWidth),
    size: asNumber(r.size, base.size),
    align:
      r.align === "center" || r.align === "right" || r.align === "left"
        ? r.align
        : base.align,
  };
};

// Migrate saved v4 defaults that would overlap the restored note/page fields.
// Keep user-adjusted positions intact.
const migrateDefaultField = (raw: unknown, legacy: LayoutTextField, current: LayoutTextField) => {
  const value = raw as Partial<LayoutTextField> | undefined;
  if (value && value.x === legacy.x && value.y === legacy.y && value.maxWidth === legacy.maxWidth && value.size === legacy.size && (value.align ?? "left") === (legacy.align ?? "left")) {
    return current;
  }
  return raw;
};

export const normalizeVoxSetlistLayout = (raw: unknown): VoxSetlistLayout => {
  const src = (raw ?? {}) as Partial<VoxSetlistLayout>;
  const base = defaultVoxSetlistLayout;

  return {
    showEventName: asBool(src.showEventName, base.showEventName),
    fields: {
      eventName: mergeTextField(base.fields.eventName, src.fields?.eventName),
      eventDate: mergeTextField(base.fields.eventDate, src.fields?.eventDate),
      bandName: mergeTextField(base.fields.bandName, src.fields?.bandName),
      pageLabel: mergeTextField(base.fields.pageLabel, migrateDefaultField(src.fields?.pageLabel,
        { x: 505, y: 704, maxWidth: 52, size: 9, align: "center" }, base.fields.pageLabel)),
      setOrder: mergeTextField(base.fields.setOrder, src.fields?.setOrder),
      totalDuration: mergeTextField(base.fields.totalDuration, src.fields?.totalDuration),
      plannedStartTime: mergeTextField(base.fields.plannedStartTime, src.fields?.plannedStartTime),
    },
    notes: {
      lighting: mergeTextField(base.notes.lighting, migrateDefaultField(src.notes?.lighting,
        { x: 92, y: 117, maxWidth: 265, size: 7, align: "left" }, base.notes.lighting)),
      pa: mergeTextField(base.notes.pa, migrateDefaultField(src.notes?.pa,
        { x: 76, y: 103, maxWidth: 280, size: 7, align: "left" }, base.notes.pa)),
      stageSummary: mergeTextField(base.notes.stageSummary, migrateDefaultField(src.notes?.stageSummary,
        { x: 35, y: 90, maxWidth: 320, size: 7, align: "left" }, base.notes.stageSummary)),
    },
    setPlot: {
      x: asNumber(src.setPlot?.x, base.setPlot.x),
      y: asNumber(src.setPlot?.y, base.setPlot.y),
      width: asNumber(src.setPlot?.width, base.setPlot.width),
      height: asNumber(src.setPlot?.height, base.setPlot.height),
      maxPoints: Math.max(1, Math.floor(asNumber(src.setPlot?.maxPoints, base.setPlot.maxPoints))),
      pointSize: asNumber(src.setPlot?.pointSize, base.setPlot.pointSize),
      drawLabels: asBool(src.setPlot?.drawLabels, base.setPlot.drawLabels),
      invertY: asBool(src.setPlot?.invertY, base.setPlot.invertY),
    },
    customLayers: Array.isArray(src.customLayers)
      ? src.customLayers.map(normalizeCustomLayer).filter((v): v is CustomLayer => Boolean(v))
      : base.customLayers,
  };
};
