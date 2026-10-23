# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

The Acadion project takes institutional data security and student privacy seriously.

If you discover a security vulnerability in Acadion:
1. **Do not disclose the issue publicly** or open a public issue on GitHub.
2. Email full vulnerability reproduction details, stack traces, and affected components to `security@acadion.edu` or open a private security advisory through GitHub.
3. Include information on whether personal student identifiable data (USN, marks, attendance) could be affected.

---

## Security Principles Enforced
- **Multi-Tenant Scoping:** Cryptographic join-code hashes and server-side membership validation prevent student access across un-enrolled classrooms.
- **Zero Hardcoded Secrets:** Spring Boot and FastAPI microservices inject all keys via parameterized environment variables.
- **Stateless Authentication:** Stateless JSON Web Tokens (JJWT) with HMAC-SHA256 signatures, expiring session windows, and role-based authorization filters.
