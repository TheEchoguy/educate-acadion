# Contributing to Acadion

Thank you for your interest in contributing to the **Acadion** academic intelligence ecosystem! We welcome contributions to improve our institutional analytics platform, multimodal question paper parsers, and explainable AI models.

---

## 🛠️ Development Workflow

### 1. Branch Naming Conventions
- `feat/<feature-name>`: New features (e.g. `feat/cie-calculator`, `feat/rag-expansion`)
- `fix/<bug-name>`: Bug fixes (e.g. `fix/roster-parser-header`, `fix/xai-shap-scale`)
- `docs/<doc-update>`: Documentation enhancements
- `test/<test-suite>`: Unit, integration, or end-to-end tests

### 2. Conventional Commit Messages
We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
- `feat:` A new feature or capability
- `fix:` A bug fix
- `docs:` Documentation-only changes
- `refactor:` Code restructuring without behavioral changes
- `test:` Adding or updating tests
- `chore:` Dependency updates, tooling, or build scripts

---

## 🧪 Testing & Validation Standards

Before submitting a Pull Request, please ensure all subsystems pass validation:

1. **Backend Tests:**
   ```bash
   cd educate/backend
   ./mvnw clean test-compile
   ./mvnw test -Dtest=*ServiceTest
   ```
2. **Frontend Build:**
   ```bash
   cd educate/frontend
   npm run build
   ```
3. **Python ML Syntax & Import Validation:**
   ```bash
   cd educate/logs
   python -m py_compile app.py rag_tutor.py ai_extractor.py ml_risk_xai.py
   ```

---

## 🔒 Security & Secrets Policy
- **Never commit live API keys, JWT secrets, or database connection strings.**
- All sensitive configurations must use environment variables or local property files (`application-local.properties`, `.env`) which are git-ignored.
