# Developer Security Checklist

## Key Security Practices for Every Developer

This checklist is a quick reference for the most important security practices to keep in mind as you design, build, and deploy your applications.

### Design & Architecture

-   [ ] **Threat Model New Features:** Have you thought about how a new feature could be abused?
-   [ ] **Apply Principle of Least Privilege:** Does every component and user have only the minimum permissions necessary?
-   [ ] **Don't Trust User Input:** Treat all data from users, services, and APIs as potentially malicious.

### Implementation

-   [ ] **Sanitize and Validate All Inputs:** Use allow-lists for validation and implement robust sanitization to prevent injection attacks (SQLi, XSS, etc.).
-   [ ] **Use Parameterized Queries:** Never concatenate strings to build SQL queries.
-   [ ] **Encode Output Correctly:** Ensure data is properly encoded for the context in which it's being rendered (HTML, JavaScript, etc.) to prevent XSS.
-   [ ] **Implement Secure Authentication & Session Management:** Use a standard, well-vetted framework. Don't roll your own.
-   [ ] **Enforce Strong Access Control:** Check authorization for every single request. Don't rely on hiding UI elements.
-   [ ] **Handle Errors and Exceptions Gracefully:** Don't leak sensitive information like stack traces to the user.

### Dependency Management

-   [ ] **Keep Dependencies Updated:** Regularly scan for and patch vulnerable third-party libraries using an SCA tool.
-   [ ] **Use Official Sources:** Only use dependencies from trusted, official repositories.

### Operations & Deployment

-   [ ] **Manage Secrets Securely:** Never hardcode secrets (API keys, passwords, certs) in source code. Use a secure secret management solution.
-   [ ] **Enable Robust Logging:** Ensure you are logging security-relevant events, such as login attempts and access control failures.
