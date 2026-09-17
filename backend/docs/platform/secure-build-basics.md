# Application Basics

If you've built something with an AI assistant and you're wondering what you've actually got, this page is the orientation. It's short on purpose.

## What your application is made of

Almost every web application has three parts, whether or not you set them up deliberately.

| Part | Also called | What it does | Who can see it |
|---|---|---|---|
| **Front end** | client, UI | The pages and the code that run in your user's browser | Anyone who can use the application |
| **Back end** | server, API | Takes requests, applies your rules, decides what to send back | Only you and your host |
| **Database** | data store | Holds what the application keeps between visits | Whoever you've granted access — often more than you think |

Plus, usually, **services you rent from other companies**: a login provider, file storage, payments, email, an AI API. Each one is another place your data goes and another key you have to look after.

That last column is the one to pay attention to. The split between front end and back end isn't just architecture — it's the line between what your users can see and what they can't.

## What leaves your server, your users can read

Everything your application sends to someone's browser, the person using that browser can read. All of it.

That's broader than most people expect, and it's worth being precise about what it covers:

- **The front-end code itself.** The browser has to download it to run it, so anything written into it — including an API key — comes along.
- **Every request and response between the browser and your back end.** Browsers have a built-in inspector (usually F12, then the Network tab) that shows these in full: the addresses, the data sent, and everything sent back.
- **Anything your API returns but your page doesn't display.** This one catches people out. If your endpoint returns a whole user record and the page only shows the name, the rest is still sitting in the response, readable by anyone who looks.

So two practical rules follow:

**A secret must never leave your server.** If something needs an API key, your back end makes that call and sends the browser the result — not the key.

**Send only the fields the page actually uses.** Hiding something in the interface doesn't hide it. If the browser shouldn't have it, don't put it in the response.

<details>
<summary>"Your users" isn't always "the public"</summary>

Who can read all this depends on who can reach your application in the first place.

- **Internet-facing** — anyone, including people who found it by accident.
- **Internal only** — your colleagues, plus anyone who gets onto the network.

That's a real difference, and it's worth knowing which one you are. But it changes the *size* of the audience, not the rule. Internal applications routinely handle salary data, customer records, and admin access, and "only people on our network" is a much larger and less predictable group than it sounds.

Treat the rules above as applying either way, and treat being internal-only as one layer of protection rather than the protection.

</details>

## What changes when you deploy

Right now your application probably runs on your laptop, and nobody else can reach it. Not because it's protected — there's just no route to it from outside your machine.

Once it's deployed, three things are true that weren't before:

- **Other people can reach it** — possibly anyone on the internet
- **Your data lives somewhere else**, on a computer you don't own
- **It keeps running when you aren't looking**, so anything wrong with it is wrong continuously

See [Deploying Your Application](/docs/secure-build-deploying) for how to do that without regretting it.

## The four things to get right

That's the whole list. Everything else in this section is one of these four in more detail.

**1. Keep your secrets out of your code.** Passwords, API keys, and tokens belong in your hosting platform's settings, not in a file — and they must never be sent to the browser.

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
