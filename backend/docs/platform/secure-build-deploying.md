# Deploying Your Application

Deploying means your code stops running on your computer and starts running on one that isn't yours, so other people can use it.

Three things change when you do that: **who can reach it**, **where your data lives**, and the fact that **it keeps running when you're not looking**. The steps below are about getting those three right.

<details>
<summary>Words people will use</summary>

| Word | What it means |
|---|---|
| **Server** | A computer that stays on and answers requests. Your laptop acts as one while you're building. |
| **Host / hosting** | The company whose computers you rent to run your application. |
| **Deploy** | Put your code on that computer and start it running. |
| **`localhost`** | "This computer." Only reachable from the machine it's running on — which is why your app is currently unreachable by anyone else. |
| **Port** | A numbered door on a computer. Your app waits at one — the `3000` in `localhost:3000`. |
| **Environment** | Which copy you mean. `development` is on your laptop, `production` is the real one people use. |
| **Domain** | The name people type, like `example.com`. Your host has a page explaining how to point one at your application. |
| **HTTPS** | The `https://` version of an address. It stops others on the network reading your visitors' traffic. Your host almost certainly sets this up for you — just check it's on. |
| **Environment variable** | A setting you give your application from outside the code. Where your passwords and keys belong. |

</details>

## 1. Pick where to run it

| | What it is | What you look after |
|---|---|---|
| **Managed hosting** | You connect your code and the platform runs it — Vercel, Netlify, Render, Azure App Service and similar | Your code, your settings, your data |
| **A server you rent** | You rent a whole computer and install everything yourself — an AWS EC2 instance, a DigitalOcean droplet | Everything, including keeping the computer itself patched and locked down |
| **Your own machine** | Your laptop or an office computer, opened up to the outside | Everything, plus your own network |

**If you're not sure, use managed hosting.** It takes the biggest job — keeping a server patched — off your plate entirely. Renting a server hands you a computer that's now yours to secure, which is real ongoing work.

Opening up your own machine is the one to avoid. It creates a path from the internet into your home or office network, and the consequences of getting that wrong reach past the application.

## 2. Move your secrets off your machine

A secret is anything that grants access: an API key, a database password, a token.

- **Take them out of your code.** If a password is typed into a file, move it to an environment variable.
- **Put the real values in your hosting platform's settings.** Every managed host has a page for this, usually called Environment Variables or Config.
- **Make sure `.env` isn't in your repository.** Add `.env` and `.env.*` to `.gitignore`. If you already committed one, the password in it must be changed — deleting the file isn't enough, because it's still in the history.
- **Never send a secret to the browser.** Anything your application sends a user — the front-end code, and every API response behind it — that user can read. If a call needs a secret, the back end makes it and sends back only the result.

Ask your assistant: *"Show me everywhere a key or password is used, and where each one comes from."*

## 3. Decide who can reach it

The question to ask before every deploy:

> **Who can reach this right now?**

Four meaningfully different answers:

1. **Only me**
2. **People on my local network** — same office or home wifi
3. **People on the company network**, including over VPN
4. **Anyone on the internet**

**Most managed hosting puts you at 4 by default**, because that's what most people want. People deploying for the first time often assume they're at 2 or 3. Check rather than assume — ask your assistant, or open the address on your phone using mobile data instead of wifi.

If it should be internal only, that's something your host or your IT team configures — it isn't a setting in your code.

Two things that quietly put you at 4 when you didn't mean to: a **preview or staging URL** that search engines can find, and a **tunnel** (ngrok, Cloudflare Tunnel) left running after you finished demoing.

## 4. Turn off the things that helped you build it

Useful while developing, a problem in production:

- **Debug mode and detailed error pages.** They show visitors how your application is put together.
- **Test and demo accounts.** Delete them, or give them real passwords.
- **Anything you disabled to make development easier.** If you turned off a login check to work on a page faster, it's still off.

## 5. Register it in Orbit

**Register your application in Orbit when you deploy it — not later.**

Orbit is the application catalog Hearst's AppSec team works from. Getting yours listed gets you three things:

- **It's on the map.** If a serious flaw turns up in a library you use, the people checking can see that you use it.
- **It's checked against security policy automatically**, and scored, so you can see what's covered and what isn't.
- **The AppSec team reviews it.** A second set of eyes catches what's easy to miss from inside your own project — like a database that anyone can read.
- **It's held to the same standard as everything else.** Your application is checked against the HTS Information Security Policy and covered by the same [six-phase security review](/docs/program-lifecycle) as applications built by full engineering teams — see [You're held to the same standard](/docs/secure-build-prelaunch#youre-held-to-the-same-standard).

**You don't need an Orbit account.** The [onboarding forms](/docs/getting-started) work without a login, on purpose.

<details>
<summary>What registering involves</summary>

It's split in two, so nobody has to answer questions they can't.

**The business part** — what the application is for: its name, what it does, whether people outside the company can reach it, where it's hosted, how important it is. If you built it, this takes a couple of minutes.

**The technical part** — how it's built: your repository link, how often you deploy, whether it handles personal or payment data and where that's stored, which other applications it talks to, and any security tools you already use.

Submitting the business part gives you a link for the technical part, which you can finish yourself or hand to whoever knows that side.

If you're working with an AI assistant, ask it to help with the technical answers — it knows your repository and dependencies better than you might. The [rules file](/docs/secure-build-agent) has it keep those answers in an `ORBIT.md` for you, so this becomes a copy-and-paste.

</details>

## 6. Check it before you tell anyone

Work through **[Before You Share It](/docs/secure-build-prelaunch)** — the full checklist, and how to get your assistant to verify most of it for you.

---

**Next: [Logins & Other People's Data](/docs/secure-build-data)** — whether you need logins, and what you take on by holding someone's data.
