# Before You Share It

Run this before anyone else can reach your application — a colleague, a customer, or the internet.

Most of it your AI assistant can check for you. Paste the checklist into your chat and ask it to go through your project item by item and tell you which ones fail.

## The checklist

```markdown
## Before I share this

### Secrets
- [ ] No password, API key, or token is written into my code
- [ ] Real values are set in my hosting platform's settings
- [ ] .env and .env.* are in .gitignore
- [ ] No .env file was ever committed
      (if one was, the values in it have been changed, not just deleted)
- [ ] Nothing secret is in front-end code that the browser downloads

### Who can reach it
- [ ] I know which it is: only me / my network / my company / the internet
- [ ] That's what I intended
- [ ] I checked rather than assumed
- [ ] No tunnel (ngrok or similar) is still running from when I was testing
- [ ] Preview and staging URLs aren't reachable by people who shouldn't have them

### Logins and permissions
- [ ] If it holds anyone's data, it has logins
- [ ] Logins use a provider, not something I wrote
- [ ] Every page that shows or changes data requires being logged in
- [ ] It checks the logged-in user OWNS the specific record, not just that
      they're logged in
- [ ] Admin pages require a login — not just a hard-to-guess address

### Data
- [ ] I know what it stores and where that lives
- [ ] I'm not collecting anything I don't use
- [ ] Nothing sensitive is written to logs
- [ ] Backups exist if losing the data would hurt
- [ ] I have restored a backup at least once to prove it works
- [ ] If it holds personal, payment, or health data, the AppSec team knows

### Leftovers from building it
- [ ] Debug mode and detailed error pages are off
- [ ] Test and demo accounts are deleted, or have real passwords
- [ ] Anything I switched off to make development easier is back on
- [ ] Commented-out code containing real credentials is gone

### Basics
- [ ] The address starts https://
- [ ] Dependencies are up to date
- [ ] I know how I'd take it offline quickly if I had to

### Orbit
- [ ] The application is registered in Orbit
- [ ] What it says about hosting, exposure, and data types is accurate
```

## How to get your assistant to check it

Paste the list, then:

> Go through this checklist against this project. For each item say pass, fail, or can't tell from here — and for the fails, tell me what to change.

The "can't tell from here" answers matter. Your assistant can see your code, so it can verify the secrets, permissions, and leftover items directly. It can't see your hosting platform's dashboard, so anything about who can reach your application or which settings are live, you'll need to check yourself.

## If something fails

Don't share it yet. The two worth stopping for:

**A secret that was committed.** Change the credential at wherever it came from — your cloud provider, the API vendor — before doing anything else. Deleting the file doesn't help, because the old value is still in your repository's history and in anyone's copy of it. Change it first, tidy up second.

**No ownership check.** If one logged-in user can see another's records by changing a number in the address, fix that before anyone gets an account. It's the difference between a small private app and a data breach.

Everything else is worth fixing but not worth panicking over.

## Then register it

If you haven't already, put the application in Orbit. It takes a couple of minutes, you don't need an account, and it's what gets your application checked by people who do this for a living — see [Deploying Your Application](/docs/secure-build-deploying#5-register-it-in-orbit).

Make sure what you enter about **hosting, whether the internet can reach it, and what data it handles** is accurate. Those three answers determine which security requirements apply to you, so a wrong answer there means you're measured against the wrong bar.

## If something goes wrong later

Tell Hearst's AppSec team. Not after you've investigated — when you first suspect it.

That includes: a credential you think may have leaked, data visible to someone who shouldn't see it, or activity you can't explain. If personal data might be involved, there may be legal deadlines already running, which is a reason to raise it early rather than quietly look into it first.

Nobody is annoyed by a false alarm.
