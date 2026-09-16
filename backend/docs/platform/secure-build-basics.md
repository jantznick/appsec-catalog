# Application Basics

If you've built something with an AI assistant and you're wondering what you've actually got, this page is the orientation. It's short on purpose.

## What your application is made of

Almost every web application has three parts, whether or not you set them up deliberately.

| Part | What it does | Where it runs |
|---|---|---|
| **The front end** | What people see and click | **In your visitor's browser**, on their own device |
| **The back end** | Does the work — handles requests, applies your rules | On a server, not on the visitor's machine |
| **The database** | Remembers things between visits | On a server, or a service you rent |

Plus, usually, **things you rent from other companies**: a login service, file storage, a payments provider, an email sender, an AI API. Each one you add is another place your data goes, and another key you have to keep safe.

## The one technical fact that matters most

**Anything in the front end is public.**

Your visitor's browser has to download the front end to run it — so anyone who visits can read all of it. Not just the text and images: the code, and anything written into it.

This is the source of the most common serious mistake people make: putting an API key or password into front-end code because that's where the call was happening. It works perfectly. It also hands that key to every visitor.

If something needs to stay secret, it has to live and be used on the **back end**. That's really the whole reason the back end exists.

## What changes when you deploy

Right now your application probably runs on your laptop, and nobody else can reach it. Not because it's protected — there's just no route to it from outside your machine.

Once it's deployed, three things are true that weren't before:

- **Other people can reach it** — possibly anyone on the internet
- **Your data lives somewhere else**, on a computer you don't own
- **It keeps running when you aren't looking**, so anything wrong with it is wrong continuously

See [Deploying Your Application](/docs/secure-build-deploying) for how to do that without regretting it.

## The four things to get right

That's the whole list. Everything else in this section is one of these four in more detail.

**1. Keep your secrets out of your code.** Passwords, API keys, and tokens belong in your hosting platform's settings, not in a file — and never in the front end.

**2. Know who can reach it.** Only you, your network, your company, or the whole internet. Pick deliberately, then check you got what you picked.

**3. Make sure people can only see their own things.** If your application holds anything belonging to more than one person, being logged in isn't enough — it has to check that *this* user owns *that* record.

**4. Know what data you're holding, and where.** You're responsible for it. If losing it would hurt, it needs backups.

## What's yours to look after

Once it's live, some things become your job that weren't before:

- **Who can reach it**, and whether that's what you intended
- **The data it holds** — where it is, who can read it, and whether you could get it back
- **Keeping it updated.** Your own code, its libraries, and — if you rented a whole server rather than using managed hosting — the server itself
- **Noticing when something's wrong.** Nothing will tell you unless something is watching

How much of that is really yours depends on how you deploy. Managed hosting takes the largest share off you.

## Two things worth doing now

**Add the rules file to your project.** [Working with Your AI Agent](/docs/secure-build-agent) gives you a file to drop in that makes your assistant apply the four things above by default, whether or not you remember them.

**Register the application in Orbit** once anyone other than you can reach it — see [Deploying Your Application](/docs/secure-build-deploying#5-register-it-in-orbit). You don't need an account. That gets it reviewed by the AppSec team, and puts it under the [same security review](/docs/secure-build-prelaunch#youre-held-to-the-same-standard) as every other application the company runs.
