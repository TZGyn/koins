# Instructions for AI assistants

- Never commit changes unless explicitly told to do so. Always ask first or wait for the user's command.
- Never manually edit `.router/router.ts` — sv-router auto-generates it from the filesystem. Just create the route file in the correct filesystem location.
- Only commit when explicitly told to do so. When asked to commit, always write a single simple line commit message.
- When asked to publish, always rebuild the DMG first (`bun run build:stable` from `apps/desktop`), wait for notarization to complete, verify with `xcrun stapler validate`, then publish the fresh DMG. Never publish a stale build.
- At the end of every response, always surface a "Pending from you" section listing anything you need from the user (decisions, permissions, credentials, confirming a plan, etc.). If nothing is pending, say "Nothing pending."
