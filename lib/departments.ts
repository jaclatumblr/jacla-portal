import {
  Lightbulb,
  NotebookPen,
  Package,
  SlidersHorizontal,
  type LucideIcon,
} from "@/lib/icons";

export type DepartmentKey = "pa" | "lighting";

export type DepartmentAction = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export type DepartmentConfig = {
  key: DepartmentKey;
  label: string;
  dashboardTitle: string;
  dashboardDescription: string;
  tone: "secondary" | "accent";
  equipmentCategory: "PA" | "Lighting";
  equipmentKicker: string;
  equipmentTitle: string;
  noteTitle: string;
  eventActionLabel: string;
  actionCards: DepartmentAction[];
};

const departmentConfigs: Record<DepartmentKey, DepartmentConfig> = {
  pa: {
    key: "pa",
    label: "PA",
    dashboardTitle: "PAダッシュボード",
    dashboardDescription:
      "PA指示、機材状況、担当イベントへの導線をまとめています。直近の対応だけでなく、過去ライブの記録もここから見返せます。",
    tone: "secondary",
    equipmentCategory: "PA",
    equipmentKicker: "PA Equipment",
    equipmentTitle: "PA機材",
    noteTitle: "PA指示",
    eventActionLabel: "PA画面を開く",
    actionCards: [
      {
        href: "/pa/instructions",
        label: "PA指示",
        description: "セトリ進行やキューの共通メモを確認します。",
        icon: NotebookPen,
      },
      {
        href: "/pa/equipment",
        label: "PA機材",
        description: "在庫と状態を確認して、要対応機材を洗い出します。",
        icon: Package,
      },
      {
        href: "/pa/console",
        label: "PAコンソール",
        description: "仮想コンソールでチャンネル構成を確認します。",
        icon: SlidersHorizontal,
      },
    ],
  },
  lighting: {
    key: "lighting",
    label: "照明",
    dashboardTitle: "照明ダッシュボード",
    dashboardDescription:
      "照明指示、機材状況、担当イベントへの導線をまとめています。現場前の確認だけでなく、過去ライブの照明記録もここから追えます。",
    tone: "accent",
    equipmentCategory: "Lighting",
    equipmentKicker: "Lighting Equipment",
    equipmentTitle: "照明機材",
    noteTitle: "照明指示",
    eventActionLabel: "照明画面を開く",
    actionCards: [
      {
        href: "/lighting/instructions",
        label: "照明指示",
        description: "シーン、カラー、キューの共有内容を確認します。",
        icon: NotebookPen,
      },
      {
        href: "/lighting/equipment",
        label: "照明機材",
        description: "在庫と状態を確認して、要対応機材を洗い出します。",
        icon: Lightbulb,
      },
    ],
  },
};

export function getDepartmentConfig(key: DepartmentKey) {
  return departmentConfigs[key];
}
