import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";

type GitHubCommit = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    committer: { date: string } | null;
    author: { date: string } | null;
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const normalizeRepo = (repo?: string | null) => repo?.replace(/^https?:\/\/github\.com\//, "").trim() ?? "";

const bumpPattern = /(\\[bump\\]|\\brelease\\b|\\bver\\b|\\bversion\\b)/i;

const parseCommitMessage = (message: string) => {
  const [subject, ...rest] = message.split(/\\r?\\n/);
  const body = rest.join("\\n").trim();
  return {
    subject: subject?.trim() ?? "",
    body: body.length > 0 ? body : null,
    isVersionBump: bumpPattern.test(subject ?? ""),
  };
};

const resolveGitRemote = () => {
  try {
    return execSync("git config --get remote.origin.url").toString().trim();
  } catch {
    return "";
  }
};

const resolveGitBranch = () => {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
  } catch {
    return "";
  }
};

const parseGitHubRemote = (remote: string) => {
  if (!remote) return null;
  let cleaned = remote.trim();
  cleaned = cleaned.replace(/^git@github\.com:/i, "");
  cleaned = cleaned.replace(/^https?:\/\/github\.com\//i, "");
  cleaned = cleaned.replace(/^ssh:\/\/git@github\.com\//i, "");
  cleaned = cleaned.replace(/\.git$/i, "");
  const [owner, repo] = cleaned.split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
};

const getRepoInfo = () => {
  const fullRepo = normalizeRepo(
    process.env.GITHUB_REPOSITORY ||
      (process.env.GITHUB_OWNER && process.env.GITHUB_REPO
        ? `${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`
        : `${process.env.VERCEL_GIT_REPO_OWNER ?? ""}/${process.env.VERCEL_GIT_REPO_SLUG ?? ""}`)
  );
  let [owner, repo] = fullRepo.split("/");

  if (!owner || !repo) {
    const remote = parseGitHubRemote(resolveGitRemote());
    if (remote) {
      owner = remote.owner;
      repo = remote.repo;
    }
  }

  let branch =
    process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || "";
  if (!branch) {
    const localBranch = resolveGitBranch();
    branch = localBranch || "main";
  }

  return { owner, repo, branch };
};

const canManageUpdates = async (token: string) => {
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user?.id) return false;
  const userId = data.user.id;

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: leadersData } = await adminClient
    .from("profile_leaders")
    .select("leader")
    .eq("profile_id", userId);
  const leaders = (leadersData ?? [])
    .map((row) => (row as { leader?: string }).leader)
    .filter((role) => role && role !== "none") as string[];

  let hasAdministrator = leaders.includes("Administrator");

  if (!hasAdministrator) {
    const { data: profileData } = await adminClient
      .from("profiles")
      .select("leader")
      .eq("id", userId)
      .maybeSingle();
    const leader = (profileData as { leader?: string } | null)?.leader;
    if (leader === "Administrator") {
      hasAdministrator = true;
    }
  }

  if (hasAdministrator) return true;

  const { data: positionsData } = await adminClient
    .from("profile_positions")
    .select("position")
    .eq("profile_id", userId)
    .eq("position", "Web Secretary");
  const hasWebSecretary = (positionsData ?? []).some(
    (row) => (row as { position?: string }).position === "Web Secretary"
  );
  return hasWebSecretary;
};

export async function POST(req: Request) {
  if (!supabaseServiceKey || !supabaseUrl) {
    return NextResponse.json(
      { error: "Supabase configuration missing" },
      { status: 500 }
    );
  }

  const syncToken = process.env.UPDATES_SYNC_TOKEN ?? "";
  const headerToken = req.headers.get("x-updates-token") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  if (syncToken && headerToken === syncToken) {
    // token ok
  } else if (bearerToken && (await canManageUpdates(bearerToken))) {
    // user ok
  } else {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { owner, repo, branch } = getRepoInfo();
  if (!owner || !repo) {
    return NextResponse.json(
      {
        error: "GitHub repo not configured",
        detail:
          "Set GITHUB_OWNER/GITHUB_REPO or configure the git remote origin.",
      },
      { status: 500 }
    );
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: latestLog } = await adminClient
    .from("update_logs")
    .select("created_at")
    .not("commit_sha", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const since = latestLog?.created_at
    ? new Date(latestLog.created_at).toISOString()
    : null;

  const githubToken = process.env.GITHUB_TOKEN ?? "";
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const commits: GitHubCommit[] = [];
  let page = 1;
  const perPage = 100;

  while (page <= 5) {
    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/commits`
    );
    url.searchParams.set("sha", branch);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    if (since) url.searchParams.set("since", since);

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: "GitHub fetch failed", detail: body },
        { status: 502 }
      );
    }
    const data = (await res.json()) as GitHubCommit[];
    commits.push(...data);
    if (data.length < perPage) break;
    page += 1;
  }

  if (commits.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }

  const shas = commits.map((commit) => commit.sha);
  const { data: existing } = await adminClient
    .from("update_logs")
    .select("commit_sha")
    .in("commit_sha", shas);
  const existingSet = new Set(
    (existing ?? []).map((row) => (row as { commit_sha?: string }).commit_sha)
  );

  const newRows = commits
    .filter((commit) => !existingSet.has(commit.sha))
    .map((commit) => {
      const parsed = parseCommitMessage(commit.commit.message || "");
      const commitDate =
        commit.commit.committer?.date ||
        commit.commit.author?.date ||
        new Date().toISOString();
      return {
        commit_sha: commit.sha,
        commit_url: commit.html_url,
        title: parsed.subject || "更新",
        summary: parsed.subject || "更新",
        details: parsed.body,
        is_version_bump: parsed.isVersionBump,
        is_published: true,
        created_at: commitDate,
      };
    })
    .sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeA - timeB;
    });

  if (newRows.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }

  const { error: insertError } = await adminClient
    .from("update_logs")
    .insert(newRows);
  if (insertError) {
    return NextResponse.json(
      { error: "Supabase insert failed", detail: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ inserted: newRows.length });
}
