# Application Security Score

Your application security score shows how well your app is protected and how well we understand it. The score is out of **100 points** and combines two things:

1. **Knowledge Sharing** (how much we know about your app)
2. **Tool Usage** (what security tools you're using)

The balance between these two depends on your application's importance. See the "Importance Weighting" section below for details.

---

## Importance Weighting

Your app's importance changes how the two scores are weighted. More important apps need better security tools. Less important apps need better documentation.

**Low Importance** (internal, low criticality, infrequent deployments)
- 60% Knowledge Sharing / 40% Tool Usage
- Focus on filling out your information

**Medium Importance** (moderate criticality)
- 50% Knowledge Sharing / 50% Tool Usage
- Balanced approach

**High Importance** (external-facing, high criticality, frequent deployments, many interfaces)
- 40% Knowledge Sharing / 60% Tool Usage
- Focus on security tools

**Note:** If you don't provide information about your app's criticality, deployment frequency, or facing status, we assume high importance. This encourages you to share complete information-accurate data might actually lower your importance score and give you better weighting.

---

## Knowledge Sharing (up to 60 points)

This measures how well you've documented your application for the security team.

### Metadata Completeness (80% of Knowledge Sharing score)

Fill out these 8 fields to earn points:

- Description
- Development Team Contact
- Repository URL
- Language
- Framework
- Server Environment
- Authentication Profiles
- Data Types

Each field you fill adds points. Fill out all 8 fields to get the full 80%.

### Metadata Review (20% of Knowledge Sharing score)

The AppSec team needs to review and verify your information. Points decrease over time:

- Reviewed today: Full 20%
- Reviewed 1 month ago: ~17%
- Reviewed 3 months ago: ~10%
- Reviewed 6 months ago: 0%

If it's been more than 6 months since review, you get 0%.

---

## Tool Usage (up to 60 points)

This measures what security tools you have set up and how well they're integrated.

We score four types of tools:

1. **SAST** (Static Application Security Testing)
2. **DAST** (Dynamic Application Security Testing)
3. **Application Firewall**
4. **API Security**

### How Tool Points Are Calculated

Each tool's score depends on:

**Integration Level (0-4 scale)**
- How deeply the tool is integrated
- How much visibility Corporate has
- Higher integration = more points

**Tool Quality**
- Managed tools (like Snyk, Tenable) = more points
- Approved unmanaged tools = medium points
- Other tools = fewer points

**Risk Factors**
- External-facing apps get more points for tools
- Apps handling PII, PCI, or PHI data get more points
- Higher risk = tools are worth more

**Active Usage (SAST/DAST only)**
- Scans should happen within 1 day of deployment
- Stale scans (more than 1 day old) get fewer points
- This encourages testing as part of your deployment process

---

## What's a Good Score?

- **76-100:** Excellent - You're doing great
- **51-75:** Good - Room for improvement
- **0-50:** Needs work - Focus on the quick wins shown in your score breakdown

The score breakdown shows exactly what you need to improve. Start with the "Quick Wins" section for the easiest improvements.
