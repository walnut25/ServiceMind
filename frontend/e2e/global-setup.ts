const apiUrl = process.env.E2E_API_URL || "http://localhost:8081";
const adminUsername = process.env.E2E_ADMIN_USERNAME || "admin";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "Admin123!";

interface TestAccount {
  username: string;
  password: string;
  roles: Array<"AGENT" | "REQUESTER">;
}

const accounts: TestAccount[] = [
  {
    username: process.env.E2E_AGENT_USERNAME || "e2e-agent",
    password: process.env.E2E_AGENT_PASSWORD || "E2eAgentPass123!",
    roles: ["AGENT"],
  },
  {
    username: process.env.E2E_REQUESTER_USERNAME || "e2e-requester",
    password: process.env.E2E_REQUESTER_PASSWORD || "E2eRequesterPass123!",
    roles: ["REQUESTER"],
  },
];

async function waitForBackend(): Promise<void> {
  const deadline = Date.now() + 60_000;
  const retry = () => new Promise((resolve) => setTimeout(resolve, 1_000));

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiUrl}/actuator/health`);
      if (response.ok && (await response.json()).status === "UP") return;
    } catch {
      await retry();
      continue;
    }
    await retry();
  }
  throw new Error(`Backend did not become healthy at ${apiUrl}`);
}

async function login(username: string, password: string): Promise<string> {
  const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(`E2E login failed for ${username}: HTTP ${response.status}`);
  }
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

async function ensureAccount(account: TestAccount, adminToken: string): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(account),
  });

  if (response.status !== 201 && response.status !== 409) {
    throw new Error(`Could not prepare ${account.username}: HTTP ${response.status}`);
  }

  try {
    await login(account.username, account.password);
  } catch (error) {
    throw new Error(
      `E2E account ${account.username} exists but does not accept the configured password. ` +
        "Use a fresh username or reset the local database.",
      { cause: error }
    );
  }
}

export default async function globalSetup(): Promise<void> {
  await waitForBackend();
  const adminToken = await login(adminUsername, adminPassword);
  for (const account of accounts) {
    await ensureAccount(account, adminToken);
  }
}
