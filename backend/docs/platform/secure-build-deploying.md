# What "Deploying" Actually Means

You've built something and it works on your computer. "Deploying" is the step where it starts running somewhere else, so other people can use it.

This page explains what actually changes when you do that — because almost every security decision you'll make later depends on understanding it.

## Where you are right now

When you run something like `npm run dev` and open `localhost:3000` in your browser, here's what's happening:

- **A program is running on your computer.** It's waiting for requests and answering them.
- **`localhost` means "this computer."** That address doesn't work from anyone else's machine. Not your colleague's, not your phone.
- **It stops when you stop it.** Close the terminal, shut your laptop, and it's gone.
- **Nobody else can reach it.** Not because it's protected, but because there's no path to it from outside your machine.

That last point is worth sitting with. Right now your application is safe mostly by accident. Nothing about it is locked down — it's just unreachable.

## What changes when you deploy

Deploying means putting your code on a computer that isn't yours, that stays on, and that other people can reach. Three things change at once.

**1. Someone else can reach it.** This is the big one. Instead of being unreachable, your application now answers requests from whoever can get to it — which might be just you, might be people inside your company's network, or might be anyone on the internet. **This is a choice you make, and it's easy to make it accidentally.**

**2. Your data lives somewhere else.** Whatever your application stores now sits on a computer in a data centre, probably in a database you didn't set up by hand. You're responsible for it being there, and for who can read it.

**3. It keeps running when you're not looking.** At 3am on a Sunday it's still up, still answering requests, still running whatever version you last pushed. Anything wrong with it is wrong continuously, not just while you're at your desk.

<details>
<summary>The words people will use, in plain terms</summary>

| Word | What it means |
|---|---|
| **Server** | A computer that stays on and answers requests from other computers. Your laptop acts as one while you're developing. |
| **Host / hosting** | The company whose computers you're renting to run your application. |
| **Deploy** | Copy your code onto that computer and start it running. |
| **`localhost` / `127.0.0.1`** | "This computer." Only reachable from the machine it's running on. |
| **Port** | A numbered door on a computer. Your app waits at one — `3000` in `localhost:3000`. A door has to be open for anyone to come through. |
| **Environment** | Which copy you're talking about. `development` is on your laptop, `production` is the real one people use, `staging` is a practice copy. |
| **Domain** | The name people type, like `example.com`, which points at your server's actual address. |
| **HTTPS** | The `https://` version of a web address. It scrambles traffic between your visitor and your server so others on the network can't read it. |

</details>

## What you become responsible for

This is the part nobody mentions. Once your application is deployed, some things become yours to look after that weren't before:

- **Who can reach it**, and whether that's what you intended
- **The data it holds** — where it is, who can read it, and whether you could get it back if it were lost
- **Keeping it patched.** Depending on how you deploy, you may now be responsible for security updates on the computer itself, not just your own code
- **Knowing when something's wrong.** Nobody will tell you unless something is watching

How much of that is yours depends heavily on *how* you deploy, which is the next choice.

## The three basic ways to do it

A quick orientation. Each has a very different amount of responsibility attached.

| | What it is | What you look after |
|---|---|---|
| **Managed hosting** | You connect your code and the platform runs it — Vercel, Netlify, Render, Heroku, Azure App Service and similar | Your code, your settings, your data. The platform patches the underlying computer. |
| **A virtual server you rent** | You rent a whole computer in a data centre and install everything yourself — an AWS EC2 instance, a DigitalOcean droplet, an Azure VM | Everything. Your code *and* the operating system, its updates, its firewall, who can log into it. |
| **Your own machine** | Your laptop or an office computer, made reachable from outside | Everything, plus the security of your own network |

**If you're not sure, use managed hosting.** It takes the largest category of work — keeping a server patched and locked down — off your plate entirely. Renting a virtual server gives you more control and hands you a computer that is now *your* responsibility to secure, which is a real job and not an obvious one.

Making your own machine reachable from the internet is the option to be most careful with. It means opening a path from outside into your home or office network, and the consequences of getting it wrong reach beyond the application itself.

## The one question to ask every time

Before any deploy, and after any change to how it's hosted:

> **Who can reach this right now?**

There are four meaningfully different answers:

1. **Only me**, on this machine
2. **People on my local network** — the same office or home wifi
3. **People on the company network**, including over VPN
4. **Anyone on the internet**

Most people building something for the first time assume they're at 2 or 3 when they're actually at 4. Managed hosting platforms deploy to the public internet by default, because that's what most people want — so unless you did something specific, assume 4 and check.

If you're using an AI assistant, ask it directly: *"Who can reach this right now — just me, our network, or the whole internet?"* It's the highest-value question on this page.

## Put it in Orbit at the same time

**Do this when you deploy, not later.** It's the step that turns your application from something only you know about into something the security team can actually help with.

Orbit is the application catalog Hearst's AppSec team uses. Registering your application there does three things for you:

- **Somebody other than you knows it exists.** If a serious vulnerability turns up in a library you're using, whoever is checking can see that your application uses it.
- **It gets checked.** Your application is evaluated against the security policy automatically, and gets a score showing where it's covered and where it isn't.
- **It gets you the checks you can't run yourself.** This is the real benefit. There's a category of problem that's invisible from the inside — a database configured so that the key in your browser can read every row, a storage bucket that's publicly listable, an admin page with no login. Your application works perfectly either way, which is exactly why these ship. Being in the catalog is what gets those checks pointed at you.

**You don't need an Orbit account.** The [onboarding forms](/docs/getting-started) work without a login, on purpose.

<details>
<summary>What registering involves</summary>

It's split in two, so nobody has to answer questions they can't.

**The business part** — what the application is for. Its name, what it does, whether people outside the company can reach it, where it's hosted, and how important it is. If you built the thing, you can answer all of this in a couple of minutes.

**The technical part** — how it's built. Your repository link, how often you deploy, whether it handles personal or payment data and where that's stored, which other applications it talks to, and any security tools you already use.

When you submit the business part you get a link for the technical part, which you can complete yourself or hand to whoever knows that side. Submitting the technical form queues it for review rather than applying immediately.

If you're working with an AI assistant, ask it to help you answer the technical questions — it knows your repository, your dependencies, and where your data goes better than you might.

</details>

Keep the answers somewhere in your project so they're easy to refresh — the [rules file](/docs/secure-build-agent) has your assistant maintain them for you.

## Before you deploy

Short list. Each item has a fuller explanation elsewhere in this section, but these are the ones that matter on day one.

```markdown
## Before I deploy

- [ ] I know who will be able to reach this (and it's what I intended)
- [ ] No passwords, API keys, or tokens are in my code
      (they come from the hosting platform's settings instead)
- [ ] My .env file is NOT committed to the repository
- [ ] Debug mode and detailed error pages are turned off
- [ ] Any test or demo login I created is removed, or has a real password
- [ ] Pages that only I should see require a login — not just a hard-to-guess URL
- [ ] HTTPS is on (the address starts https://)
- [ ] I know what data this stores and where it lives
- [ ] If losing that data would hurt, backups exist
- [ ] The application is registered in Orbit
```

If you're using an AI assistant, paste that list into your chat and ask it to check each item against your project. It can verify most of them directly.

## Where to go next

- **Who can reach it** — the four levels above, and how to actually enforce the one you want
- **Where to run it** — choosing between the three hosting options in detail
- **Keys, secrets and configuration** — the most common way this goes wrong
- **[Working with Your AI Agent](/docs/secure-build-agent)** — the rules file, so your assistant applies this by default

If your application is holding other people's data or is reachable from the internet, the [AppSec program lifecycle](/docs/program-lifecycle) is where this goes next — particularly [Plan & Design](/docs/phase-plan-design), which has a worksheet for working out how much protection your application actually needs.
