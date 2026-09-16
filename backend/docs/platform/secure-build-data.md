# Logins & Other People's Data

The point where an application stops being your project and starts being your responsibility is the point it holds something belonging to someone else. This page is what to do about that.

## Do you need logins?

Yes, if your application does either of these:

- **Holds anything belonging to a specific person** — their notes, their files, their orders, their messages
- **Does anything you wouldn't let a stranger do** — change data, send messages, spend money, view internal information

No, if it's the same for everybody and read-only. A brochure site doesn't need logins.

If you're unsure, assume yes. Adding logins later means retrofitting them around data that's already there, which is harder than starting with them.

## Don't build logins yourself

Use a login service — Okta, Auth0, Microsoft Entra, Clerk, or whatever your hosting platform offers.

Writing your own means writing password storage, password resets, session handling, and lockout, correctly. These are genuinely hard to get right, they're the first thing anyone attacks, and every mistake in them is serious. A provider has already done it.

Ask your assistant to use one. It will offer to build you a login form from scratch if you don't say otherwise, because that's the literal answer to "add a login."

## Being logged in is not the same as being allowed

This is the mistake that most often exposes real data, and it survives every other precaution.

Say your application shows an order at an address like `/orders/1043`. A logged-in user changes that to `/orders/1044` and sees somebody else's order. Nothing was broken into — they were logged in, the page worked exactly as written, and it simply never checked whose order it was.

**Every time your application fetches or changes a record, it has to check the logged-in user owns it.** Not "is this user logged in" — "is this *their* thing."

Two things that are not protection:

- **A hard-to-guess address.** Long random IDs help, but they leak — in logs, in shared links, in browser history.
- **Hiding the button.** If the page doesn't show an edit button, the underlying request still works.

Ask your assistant: *"Is there anywhere in this application where one user could see or change another user's data?"* Ask it again after adding any feature that shows saved records.

## Collect less

The simplest way to reduce what you can lose is to hold less of it.

Before adding a field, ask what breaks if you don't collect it. Date of birth, phone number, full address, ID numbers — each one is easy to add and changes what happens if your database is exposed.

This applies to your assistant's defaults too. Asked for a sign-up form, it may well produce one with a dozen fields because that's what sign-up forms usually look like. You only need the ones your application actually uses.

## Know where your data actually lives

You should be able to answer, without looking it up:

- **What** your application stores
- **Where** it is — which service, which provider
- **Who can read it** besides your application
- **What would happen** if it were all deleted tomorrow

That last one decides whether you need backups. If losing it would be painful, set them up — and **restore one once**, to confirm you actually can. An untested backup is a guess.

## Things to keep out of your logs

Logs get copied into places you don't expect and kept longer than you'd think. Never write these into them:

- Passwords, even wrong ones
- API keys, tokens, session cookies
- Card numbers
- Health information, government ID numbers
- Whole user records, when you only needed the ID

## If it's personal, payment, or health data — say so

If your application handles any of these, tell Hearst's AppSec team and make sure it's recorded in Orbit:

- **Personal data** about identifiable people — especially anyone in the EU or UK
- **Payment card data** of any kind
- **Health information**

These carry legal obligations that have nothing to do with how well your code is written, and they change what's required of the application. This is the single most important thing to get onto your Orbit record accurately — it's one of the questions the [onboarding form](/docs/getting-started) asks, and it drives which policy requirements apply to you.

If you're not sure whether what you're holding counts, ask. It's a short conversation and a bad thing to get wrong quietly.

## Questions for your assistant

| Ask | Catches |
|---|---|
| "Is there anywhere one user could see another user's data?" | The ownership-check problem above |
| "What personal data does this store, and where does it end up?" | Data you didn't realize you'd started collecting |
| "Are we logging anything sensitive?" | Passwords and tokens in logs |
| "If someone found this URL with no login, what could they do?" | Pages that were never protected |
| "What would we lose if the database were deleted right now?" | Missing backups |

## Next

- **[Before You Share It](/docs/secure-build-prelaunch)** — the checklist to run before anyone else uses this
- **[Working with Your AI Agent](/docs/secure-build-agent)** — the rules file, which covers the ownership check and the logging rules automatically
