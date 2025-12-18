# Scoring Methodology

Our application security score is a holistic measure designed to quantify the partnership between application teams and the corporate security program. It provides a clear, data-driven understanding of an application's risk profile by combining its inherent security posture with the level of visibility and collaboration shared with Corporate.

The goal is to bridge information gaps and enable a proactive security partnership. A high score indicates not only that an application is well-secured, but also that Corporate has the necessary insight to provide effective support, respond to incidents, and accurately assess enterprise-wide risk.

The total score is calculated out of **100 points** and is composed of two equally weighted categories:

1.  **Corporate Knowledge-Sharing (50 points)**
2.  **Technical Security Posture (50 points)**

---

### 1. Corporate Knowledge-Sharing (up to 50 points)

This score directly measures the level of insight the corporate security team has into an application. Even a well-secured application can present a risk to the enterprise if its architecture, data handling practices, and ownership are not clearly documented and shared. This score quantifies that shared knowledge.

The score is based on two factors:

*   **Metadata Completeness (40 points):** Points are awarded for providing a comprehensive operational picture of the application by filling out these eight fields:
    *   `Description`
    *   `Owner`
    *   `Repository URL`
    *   `Language`
    *   `Framework`
    *   `Server Environment`
    *   `Authentication Profiles`
    *   `Data Types`
*   **Metadata Attestation (10 points):** The full 10 points are awarded if the AppSec team has reviewed and attested to the accuracy of the application's metadata within the last 6 months.

---

### 2. Technical Security Posture (up to 50 points)

This score measures the implementation and integration of key security tools across four critical areas: SAST, DAST, App Firewall, and API Security. It reflects the application's technical defenses against common threats.

The score for each tool is determined by a weighted formula that considers three main factors:

*   **Integration Level:** How deeply the tool is integrated into the development lifecycle and the degree of visibility shared with Corporate. This is measured on a 0-4 scale, from "Tool Implemented with no data sharing" to "Corporate is a full-service partner."
*   **Tool Quality:** The specific tool being used. Centrally managed and approved tools (like Snyk, Tenable WAS) contribute more to the score, reflecting their effectiveness and the level of corporate support available.
*   **Application Risk Factors:** The score is adjusted based on the application's inherent risk. An `External` facing application or one that handles `PII`/`PCI` data is higher risk, and thus the value of implemented security controls is weighted more heavily.

By combining these factors, the score accurately reflects not just whether a tool is present, but how effectively it's implemented in the context of the application's specific risk profile.
