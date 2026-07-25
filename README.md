# HelloTalk AI Clone

This project is a premium, pixel-perfect clone of HelloTalk, built autonomously by an AI Swarm. 

## Advanced AI Factory Tooling
The AI Swarm has been fully equipped with autonomous workflow management.

**Tools Installed:**
- **Dependabot:** Fully configured (`.github/dependabot.yml`) to automatically submit PRs for outdated frontend/backend packages every week.
- **Ngrok:** Installed in the backend for webhook testing. The AI can now test LiveKit and Stripe payments locally using `npx ngrok http 3000`.
- **Two-Way Sync:** A GitHub Action perfectly syncs `TODO.md` with GitHub Issues.

**Pending Setup (Action Required):**
- **GitHub CodeQL:** To prevent the AI from accidentally writing vulnerable code, please go to your GitHub repository -> Settings -> Code Security and enable "CodeQL Analysis". This will automatically scan every commit the AI pushes for vulnerabilities.
