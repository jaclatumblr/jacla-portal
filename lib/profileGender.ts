export const profileGenderOptions = [
  { value: "male", label: "男性" },
  { value: "female", label: "女性" },
  { value: "other", label: "その他 / 回答しない" },
] as const;

export type ProfileGender = (typeof profileGenderOptions)[number]["value"];
export type BinaryProfileGender = Extract<ProfileGender, "male" | "female">;

export const normalizeProfileGender = (value: string | null | undefined): ProfileGender | null => {
  switch (value) {
    case "male":
    case "female":
    case "other":
      return value;
    default:
      return null;
  }
};

export const isBinaryProfileGender = (
  value: ProfileGender | null | undefined
): value is BinaryProfileGender => value === "male" || value === "female";

export const getProfileGenderLabel = (value: string | null | undefined) => {
  switch (value) {
    case "male":
      return "男性";
    case "female":
      return "女性";
    case "other":
      return "その他 / 回答しない";
    default:
      return "未設定";
  }
};
