# Working with Your AI Agent

If you're building an application with an AI coding assistant — Claude Code, Cursor, Copilot, or anything similar — this page gives you a file to drop into your project that makes the assistant build more safely by default.

New to this? Start with [Application Basics](/docs/secure-build-basics).

You don't need to understand every line of it. Your agent does, and that's the point.

## Why this exists

An AI assistant will do what you ask. Ask it to "make the API call work" and it may well put your API key somewhere every visitor to your site can read it — not because it's careless, but because you asked for working, and it gave you working.

It also tends not to volunteer the things you didn't ask about. It won't usually stop and say "by the way, the database you just created is readable by anyone on the internet," because that wasn't the question.

A rules file fixes both problems at once. It sits in your project, your assistant reads it at the start of every session, and it applies whether or not you remember any of this. That's a much better arrangement than documentation you have to remember to come back to.

## Step 1 — Add the rules file to your project

Create a file in the top level of your project folder and paste this in.

<details>
<summary>The rules file — copy all of this</summary>

```markdown
# Security rules for this project

Follow these whenever you write, change, or deploy code here. If something
I ask for conflicts with a rule, say so and explain the trade-off rather
than quietly doing it anyway.

## Never do these

- Never put a password, API key, token, or connection string directly in
  the code. Use an environment variable and add it to .env.example with a
  placeholder value, never a real one.
- Never commit a .env file, private key, or credentials file. Make sure
  .gitignore covers .env, .env.*, *.pem, *.key, and *.p12.
- Never put a secret in code that runs in the browser. Anything in the
  frontend is downloadable by every visitor. If an API needs a secret,
  the call belongs on the server.
- Never turn off, skip, or weaken a security check to make something
  work or to make a test pass. Tell me it's blocking and why instead.
- Never write my own authentication, password hashing, session handling,
  or crypto. Use a well-established library or a hosted provider.
- Never log passwords, tokens, card numbers, health data, government ID
  numbers, or full personal records.

## Before anything goes online

When I ask you to deploy, publish, or "put this live", first tell me in
plain language:

1. Who will be able to reach this — just me, people on our network, or
   anyone on the internet?
2. What data it will hold, and where that data will physically live.
3. Whether it needs a login, and whether it has one.

Then check:

- Debug mode, verbose errors, and stack traces are off.
- Any seeded demo, test, or admin account is removed or has a real
  password.
- Secrets come from the hosting platform's environment settings, not
  from a file in the repository.
- HTTPS is on, and plain HTTP redirects to it.
- Admin pages are behind a login, not just at an unguessable URL.
- Storage buckets and databases are not publicly readable.

## Who can reach what

- For local development, bind servers to localhost (127.0.0.1), not to
  0.0.0.0. If I need it reachable from another device, ask me first and
  tell me what that exposes.
- Do not set up a public tunnel (ngrok, Cloudflare Tunnel, or similar)
  without telling me it makes my machine reachable from the internet
  while it's running.
- Default to the most private option that does what I asked. If I ask
  for something to be "shared", ask whether I mean internal or public.

## Logins and permissions

- Use a hosted identity provider where one is available.
- Every route that shows or changes data requires a logged-in user
  unless I have explicitly said it is public.
- Check that the logged-in user actually owns the specific record being
  requested. Do not rely on the ID being hard to guess.
- New endpoints deny by default.
- Admin capability is a separate check, not a hidden page.

## Handling what users send

- Use parameterized queries. Never build SQL by joining strings.
- Validate on the server, even if the browser already validated.
- Escape or encode output for wherever it's rendered.
- For file uploads: check the type server-side, cap the size, generate
  the stored filename yourself, and store files somewhere they cannot be
  executed.

## Data

- Collect the minimum needed for the feature I asked for.
- Tell me if a change starts storing personal, payment, or health data —
  that changes what rules apply to this project.
- Set up backups for anything that would hurt to lose, and tell me how
  to restore one.

## Dependencies

- Prefer the standard library or something already installed.
- When you add a package, say in one line why it's needed.
- Commit the lockfile.

## Registering this in Orbit

Orbit is our company's application catalog. Once this application is
reachable by anyone other than me, it needs to be in there — that's what
gets it checked for the kinds of misconfiguration I can't see myself.

- The first time we deploy somewhere other people can reach, tell me to
  register it, and offer to help me answer the technical questions.
- Keep a file called ORBIT.md in this project with the answers the
  onboarding form asks for, and update it whenever they change:
    - What this application does, in one or two sentences
    - Who owns it, and a contact for the team
    - Whether people outside the company can reach it
    - Where it's hosted
    - The repository URL
    - What kind of data it handles, and where that data is stored
    - Whether it touches payment, health, or personal data
    - Which other applications it talks to
    - Which security tools already cover it
- Tell me when a change makes any of those answers out of date —
  especially if it becomes reachable from the internet, or starts
  handling a new kind of personal data.

## How to work with me

- Before a change that affects who can access what, or how data is
  stored, tell me in one or two plain sentences what's changing.
- If I ask for something that would expose data or weaken security, say
  so directly and offer the safer version. Don't just do it.
- If I ask you to hardcode a secret, refuse and show me the environment
  variable version instead.
- When you finish something security-relevant, tell me how I can check
  it myself.
- Assume I don't know the jargon. Explain in plain words.
```

</details>

Name it whatever your assistant looks for. The two common conventions are **`CLAUDE.md`** (Claude Code) and **`AGENTS.md`** (used by several tools) — check your assistant's documentation for the filename it reads automatically. If yours doesn't read a file by convention, save it as `SECURITY-RULES.md` and paste the contents into the chat at the start of a session.

If you already have a `CLAUDE.md` or `AGENTS.md` with project instructions, add this to the bottom of it rather than replacing what's there.

## Step 2 — Check that it's working

Ask your assistant this, in a new session:

> What security rules are you following for this project?

If it can summarize them back, it's reading the file. If it can't, the filename is probably wrong for your tool.

## Questions worth asking your agent

The rules file handles the defaults. These questions catch the things it can't.

| Ask this | Why it's worth asking |
|---|---|
| "Who can reach this right now — just me, our network, or the whole internet?" | The single most useful question on this page, and the one people don't think to ask until after |
| "What data does this store, and where does it actually live?" | You're accountable for this and often don't know the answer |
| "Is there anything here that would let one user see another user's data?" | Catches the ownership-check problem, which scanners generally miss |
| "Show me everywhere a secret or key is used, and where each one comes from" | Surfaces anything hardcoded, in one pass |
| "If someone found this URL and had no login, what could they do?" | Reframes the app from an attacker's side without needing jargon |
| "What did you add as a dependency, and why?" | Catches packages pulled in to solve something a built-in would have handled |
| "What would you be worried about if this went public tomorrow?" | Often the highest-value question, because it invites the things you didn't ask about |

Ask them again after any significant change. The answers move.

## What your agent won't catch

Being honest about the limits, because the rules file can make things feel more settled than they are:

- **Whether the data you're collecting is data you should be collecting.** That's a judgment call about your business, not your code.
- **Whether your hosting account itself is secure** — your own password, your own multi-factor authentication, who else has access to it.
- **Anything outside the code it can see.** A misconfigured setting in your hosting provider's dashboard is invisible to it.
- **Whether it silently did something it shouldn't.** The rules reduce that a lot; they don't eliminate it. The questions above are how you check.

## Register it in Orbit

**Add your application to Orbit as soon as anyone other than you can reach it.**

Orbit is Hearst's application catalog. Listing yours means the security team knows it exists, it's checked against policy automatically, and someone looks at it for problems that are hard to spot from the inside — like a database that anyone can read.

**You don't need an Orbit account.** The [onboarding forms](/docs/getting-started) work without a login — a short business form about what the application is, then a technical form you can fill in yourself or hand to someone who knows that side.

The rules file above has your assistant keep an `ORBIT.md` in your project with the answers already written down, so registering is a copy-and-paste rather than an interview. Ask it: *"Fill in ORBIT.md for this project."*

[What "Deploying" Actually Means](/docs/secure-build-deploying) covers what registration involves in more detail. Once your application is in the catalog, the [AppSec program lifecycle](/docs/program-lifecycle) is where it goes next — particularly [Plan & Design](/docs/phase-plan-design), which has a worksheet for working out how much protection it actually needs.
