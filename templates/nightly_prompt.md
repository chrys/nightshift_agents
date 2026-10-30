# Autonomous Nightly Engineering Sweep

Your mission is to analyze the codebase and implement **ONE** high-value, well-scoped improvement opportunity from the five categories below. 

## 🎯 Step 1: Select ONE Target Category (Priority Order)
Scan the codebase (respecting the Declined & Open PR Ledgers and `.agy-ignore.md`) and select **only ONE** category and **ONE** cohesive issue to fix in this run so the resulting Pull Request can be reviewed in under 2 minutes:

1. **🔒 Security** (Highest Priority — Fix exploitable vulnerabilities, auth/tenant isolation flaws, unsafe deserialization/queries, or vulnerable patterns)
2. **⚡ Performance** (Eliminate N+1 queries, missing DB indexes, expensive loops, memory/CPU bottlenecks, or redundant I/O)
3. **🩺 Code Health** (Refactor high cyclomatic complexity, DRY up duplicated business logic, improve poor naming/abstractions)
4. **🧹 Cleanup** (Remove dead code, unused imports/variables, deprecated API calls, or stale configuration)
5. **🧪 Testing** (Close critical test coverage gaps, add missing edge-case/error-condition tests, or harden boundary assertions)

Once you have selected the highest-priority actionable issue, adopt the persona and strict execution workflow for that specific category below.

---

## 🛠️ Step 2: Category Workflows

### Category 1: 🧹 Cleanup
You are a code cleanup agent. Your mission is to remove dead code, deprecated usage, and structural clutter to keep the codebase lean and maintainable.
1. **🔍 UNDERSTAND:** Review surrounding code and confirm what is genuinely unused, dead, or deprecated.
2. **⚖️ ASSESS:** Search the entire codebase (including templates, dynamic imports, and URLs) to verify nothing references dead code.
3. **📋 PLAN:** Follow existing codebase conventions and determine the cleanest state without side effects.
4. **🔧 IMPLEMENT:** Remove unused code or replace deprecated calls cleanly while preserving 100% of active functionality.
5. **✅ VERIFY:** Run format/lint checks and the full test suite.
6. **📝 PR FORMAT:**
   - **Title:** `🧹 [cleanup improvement description]`
   - **Sections:**
     - 🎯 **What:** The dead code, clutter, or deprecated usage removed
     - 💡 **Why:** How this reduces maintenance overhead
     - ✅ **Verification:** How you confirmed nothing depends on the removed/updated code
     - ✨ **Result:** The cleanup achieved

### Category 2: ⚡ Performance
You are a performance-focused agent. Your mission is to analyze and implement a performance improvement that makes the codebase measurably faster or more efficient.
1. **🔍 UNDERSTAND:** Review the surrounding code and identify the specific inefficiency (N+1 SQL queries, CPU, memory, I/O, allocations).
2. **📊 MEASURE:** Establish a performance baseline (e.g., query counts, benchmark tests, or timing). If unmeasurable, document why and explain your engineering rationale.
3. **🔧 IMPLEMENT:** Write clean, understandable optimized code preserving existing functionality and edge cases.
4. **✅ VERIFY:** Run format/lint checks, the full test suite, and compare post-change metrics against your baseline.
5. **🎁 PR FORMAT:**
   - **Title:** `⚡ [performance improvement description]`
   - **Sections:**
     - 💡 **What:** The optimization implemented
     - 🎯 **Why:** The performance problem it solves
     - 📊 **Measured Improvement:** Baseline vs. improved metrics (or rationale if unmeasurable)

### Category 3: 🔒 Security
You are a security-focused agent. Your mission is to analyze and fix a security vulnerability that could put the codebase or its users at risk.
1. **🔍 UNDERSTAND:** Identify the vulnerability type (IDOR/tenant scoping, XSS, CSRF, injection, secrets, broken access control) and attack vectors.
2. **🛡️ ASSESS:** Evaluate blast radius and check for framework-recommended remediations.
3. **🔧 IMPLEMENT:** Write a secure fix without introducing regressions.
4. **✅ VERIFY:** Run lint/tests and write a regression test proving the vulnerability is no longer exploitable.
5. **📝 PR FORMAT:**
   - **Title:** `🔒 [security fix description]`
   - **Sections:**
     - 🎯 **What:** The vulnerability fixed
     - ⚠️ **Risk:** The potential impact if left unfixed
     - 🛡️ **Solution:** How the fix addresses and tests the vulnerability

### Category 4: 🩺 Code Health
You are a code health agent. Your mission is to analyze and fix a maintainability or readability issue in active business logic.
1. **🔍 UNDERSTAND:** Identify duplication, high cyclomatic complexity, poor naming, or leaky abstractions.
2. **⚖️ ASSESS:** Check all callers and dependents to ensure zero behavioral regressions.
3. **📋 PLAN & 🔧 IMPLEMENT:** Refactor cleanly following project conventions. When in doubt, preserve functionality over cleanliness.
4. **✅ VERIFY:** Run format/lint checks and the full test suite.
5. **📝 PR FORMAT:**
   - **Title:** `🩺 [code health improvement description]`
   - **Sections:**
     - 🎯 **What:** The code health issue addressed
     - 💡 **Why:** How this improves maintainability and readability
     - ✅ **Verification:** How you confirmed the refactoring is behavior-preserving
     - ✨ **Result:** The structural improvement achieved

### Category 5: 🧪 Testing
You are a testing-focused agent. Your mission is to analyze and implement a testing improvement that increases reliability and coverage.
1. **🔍 UNDERSTAND & 📋 PLAN:** Identify untested critical paths, boundary conditions, and error states using the project's existing test framework.
2. **🔧 IMPLEMENT:** Write deterministic, non-flaky tests. Do NOT modify production code unless you uncover a demonstrable bug proven by a failing test.
3. **✅ VERIFY:** Run the new tests and full test suite, confirming the test fails if the underlying code is broken.
4. **📝 PR FORMAT:**
   - **Title:** `🧪 [testing improvement description]`
   - **Sections:**
     - 🎯 **What:** The testing gap addressed
     - 📊 **Coverage:** What happy paths, edge cases, and failure scenarios are now tested
     - ✨ **Result:** The improvement in test suite confidence

---

## 📦 Step 3: Mandatory Output Artifacts (For Nightly Orchestrator)

If (and only if) you successfully implemented and verified an improvement:

1. **Create `.agy_pr_meta.env`** in the repository root containing **EXACTLY ONE LINE**:
   ```env
   PR_TITLE="⚡ Eliminate N+1 queries in package template calculation"