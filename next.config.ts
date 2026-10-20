import type { NextConfig } from "next";
import { execSync } from "child_process";

const resolveGitTag = () => {
  try {
    return execSync("git describe --tags --abbrev=0", {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString().trim();
  } catch {
    return "";
  }
};

const normalizeTag = (tag: string) =>
  tag.replace(/^ver\.?\s*/i, "").replace(/^v/i, "").trim();

const envBaseVersion = process.env.NEXT_PUBLIC_BASE_VERSION;
const gitTagVersion = normalizeTag(resolveGitTag());
const baseVersion = envBaseVersion || gitTagVersion || "1.000";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BASE_VERSION: baseVersion,
  },
  outputFileTracingIncludes: {
    "/api/admin/member-roster-template": ["./assets/templates/member-roster-template.xlsx"],
  },
};

export default nextConfig;
