import { checkReadiness } from "../config/readiness";

const HELP_TEXT = `Usage: npm run readiness:check [-- --help]

Checks whether the application's environment configuration is structurally
ready, without printing any secret values.

Inspects: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL,
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.

Prints a checklist of "ready", "not configured", or "invalid" for each
item and exits with code 0 only if every item is ready. Never intended to
be run in CI, since CI runs without production secrets.

Options:
  --help, -h   Show this help message and exit.
`;

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP_TEXT);
    process.exitCode = 0;
    return;
  }

  const result = checkReadiness(process.env);
  for (const item of result.items) {
    console.log(`${item.label}: ${item.status}`);
    if (item.detail) {
      console.log(`  ${item.detail}`);
    }
  }

  process.exitCode = result.ready ? 0 : 1;
}

main();
