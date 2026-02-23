

**Workflow: SonarQube-to-C++20 Remediation Pipeline**

## **Overview**

This workflow defines the automated cycle of ingesting a SonarQube violation, processing it through the C++20 Skill modules, and verifying the fix.

## **Step-by-Step Execution**

### **Phase 1: Ingestion & Analysis**

1. **Trigger:** A new SonarQube scan completes, or a developer requests a "Legacy Cleanup" on a specific directory.  
2. **Report Parsing:** Extract issues from sonar-report.json.  
3. **Context Enrichment:** Use clangd or compile\_commands.json to map the line number to the full symbol definition (indispensable for C++).

### **Phase 2: Skill Dispatch (With Memory Issue Mapping)**

The Agent evaluates the issue\_type and selects the appropriate skill. **For memory issues specifically:**

| SonarQube ID | Severity | Issue Description | Skill Module | Recommended Action | Effort |
| :---- | :---- | :---- | :---- | :---- | :---- |
| S1016 | Blocker | Memory leak on object type | skill\_memory.md (Proc A) | Convert to `unique_ptr` or `shared_ptr` | Low |
| S1029 | Critical | Memory leak on POD type | skill\_memory.md (Proc A) | Convert to `vector<T>` or `make_unique<T>` | Low |
| S2095 | Major | Object created but not used | skill\_memory.md (Proc A) | Assign result to smart pointer immediately | Medium |
| S5397 | Blocker | Delete non-owning pointer | skill\_memory.md (Proc A) | Remove `delete` and use ownership analysis | High |
| S1016 (null deref) | Critical | Potential null dereference | skill\_memory.md (Proc B) | Use `gsl::not_null` or `std::optional<T&>` | Low |
| S3584 | Blocker | Buffer overflow in array | skill\_memory.md (Proc C) | Replace with `std::array` or `std::span` | Medium |
| S6072 | Critical | Unsafe pointer arithmetic | skill\_memory.md (Proc D) | Use `std::span` for view operations | Medium |
| S3584 (string) | Critical | Unsafe string operations | skill\_memory.md (Proc D) | Replace with `std::string` or `std::string_view` | Low |

### **Phase 3: The "Sandboxed" Fix (Memory-Specific Practices)**

1. **Branching:** Create a temporary git branch: `fix/sonar-<ID>-<description>` (e.g., `fix/sonar-S1016-database-leak`)  
2. **Refactoring:** Apply the code transformation identified in the Skill module:  
   - Follow the exact procedure (Procedure A/B/C/D in skill\_memory.md)  
   - Make **minimal changes** to satisfy the SonarQube issue only  
3. **Formatting:** Run clang-format to ensure the new C++20 code matches the project style guide:  
   ```bash
   clang-format -i <modified-file.cpp>
   ```
4. **Local Dry-Run:** Compile locally to catch obvious errors:  
   ```bash
   g++ -std=c++20 -Werror -Wall <file.cpp>
   ```

### **Phase 4: Multi-Layer Verification (Memory Safety Focused)**

1. **Compiler Check:** Verify the fix compiles with strict flags and no memory errors:  
   ```bash
   g++ -std=c++20 -Werror -Wall -Wextra -fsanitize=address -fsanitize=undefined <file.cpp>
   ```
   - **Pass Criteria:** No compilation errors, no AddressSanitizer/UBSan warnings  

2. **Static Analysis:** Run clang-tidy to ensure C++20 best practices:  
   ```bash
   clang-tidy -checks='modernize-*,cppcoreguidelines-*,readability-*' <file.cpp> -- -std=c++20
   ```
   - **Pass Criteria:** No violations related to smart pointers, memory management, or null safety  

3. **Sonar Delta Scan:** Re-run SonarQube scanner on the modified file:  
   ```bash
   sonar-scanner -Dsonar.projectKey=my-project
   ```
   - **Pass Criteria:** The specific SonarQube ID is **RESOLVED** (not suppressed or commented out)  

4. **Functional Test:** Execute the relevant Boost.Test suite for the modified module:  
   ```bash
   boost_test_runner --run_test=ModuleUnderTest
   ```
   - **Pass Criteria:** All tests pass, no new test failures introduced  
   - **Regression Check:** Behavior is **identical** to the pre-fix version (byte-for-byte compatibility where applicable)  

**If any step fails:**  
   - Analyze error and adjust fix per skill\_memory.md procedures  
   - If ambiguous, revert branch and log "Manual Review Required" ticket  
   - Feed error back to agent for re-analysis

### **Phase 5A: Success Path — Feedback Loop & PR Generation**

If all verifications pass:

1. **PR Generation:** Open a Pull Request with the following template:  
   ```
   Title: [SonarQube Fix] Resolve <ISSUE-ID>: <Issue Description>
   
   **Fixed Issue:**
   - SonarQube ID: <S####>
   - Severity: <Blocker/Critical/Major>
   - Rule: <Rule Name>
   
   **Changes:**
   - [Specific transformation applied from skill_memory.md]
   
   **Validation:**
   - [✓] Compiles with -std=c++20 -Werror
   - [✓] Clang-Tidy: No violations
   - [✓] SonarQube: Issue resolved
   - [✓] All tests pass
   
   **Related Files:**
   - [Modified file(s)]
   ```

2. **Documentation:** Update remediation\_log.csv with:
   ```
   Date,SonarQube-ID,File,Original-Pattern,C++20-Pattern,Procedure,Status
   2026-02-22,S1016,db.cpp,raw pointer,unique_ptr,Proc A,MERGED
   ```

### **Phase 5B: Failure Path — Rollback & Escalation**

If any verification fails:

1. **Immediate Rollback:**  
   ```bash
   git reset --hard HEAD
   git branch -D fix/sonar-<ID>
   ```

2. **Log Escalation Ticket:**  
   ```
   Title: [Manual Review] SonarQube <ID> in <File>
   
   **Issue:** Automated fix failed due to:
   - [Specific error or ambiguity]
   
   **Reason for Failure:**
   - [Ownership unclear / Requires refactoring beyond scope / Complex macro usage]
   
   **Suggested Next Step:**
   - Senior developer to review ownership model
   - Determine if architectural change needed
   - Re-attempt with refined procedure
   ```

3. **Agent Status:** Skip to next issue in queue

## **Error Handling & Edge Cases (Memory-Specific)**

### **Ambiguous Ownership**

**Scenario:** A raw pointer is assigned from multiple sources (member initialization, assignment operator, etc.) and it's unclear who owns it.

**Agent Action:**
- **Do NOT proceed** with an automated fix
- **Leave a TODO comment:**
  ```cpp
  // TODO(SONAR-S1016): Ownership of 'ptr' is ambiguous:
  // - Initialized in constructor: ptr = new T();
  // - Also assigned in reset(): ptr = other->ptr;
  // Requires manual analysis to determine unique vs. shared ownership.
  // MANUAL_REVIEW_REQUIRED
  ```
- **Escalate** to manual review queue

### **Macro Bloat & Preprocessor Obscurity**

**Scenario:** The memory allocation is heavily wrapped in preprocessor macros (e.g., `#ifdef DEBUG`, `#define ALLOCATE(x)`).

**Agent Action:**
- **Flag file as** "Incompatible for Automated Remediation"  
- **Mark in log:** `Status = MANUAL_REVIEW_SKIPPED`  
- **Reason:** Macro expansion context is unavailable; risk of semantic shift  

### **Public API / ABI Stability**

**Scenario:** The file is part of a public C++ API, and changing function signatures would break ABI compatibility.

**Agent Action:**
- **Use internal wrapper approach:**
  ```cpp
  // PUBLIC (unchanged for ABI compatibility)
  void processData(Widget* w);
  
  // PRIVATE (safe implementation)
  void processData_Impl(gsl::not_null<Widget*> w);
  
  // Implementation delegates
  void processData(Widget* w) {
      if (w) { processData_Impl(w); }
  }
  ```
- **Flag PR for review:** "ABI-sensitive change in public API"  

### **Circular Dependencies in shared\_ptr**

**Scenario:** Parent holds `shared_ptr<Child>`, Child holds `shared_ptr<Parent>` → memory leak.

**Agent Action:**
- **Detect cycle** using std::weak\_ptr pattern  
- **Fix by replacing:**
  ```cpp
  // BEFORE (Leak!)
  class Parent {
      std::shared_ptr<Child> child;
  };
  class Child {
      std::shared_ptr<Parent> parent;  // CIRCULAR REF
  };
  
  // AFTER (Fixed)
  class Parent {
      std::shared_ptr<Child> child;  // Parent owns Child
  };
  class Child {
      std::weak_ptr<Parent> parent;  // Child only observes Parent
  };
  ```
- **Add test** to verify cycle detection  

### **Exception Safety Mismatch**

**Scenario:** Converting to RAII changes the exception safety guarantee (e.g., from "no-throw" to "strong" due to allocation).

**Agent Action:**
- **Check if exception safety is documented** in function comments  
- **If no-throw is required:**
  - Use `std::nothrow` allocation: `make_unique<T>()` cannot fail, but `vector.emplace_back()` can  
  - **Flag for review** if exception handling needs adjustment  
- **If strong guarantee is acceptable:**
  - Proceed with fix and update documentation

## **Quick Reference: Memory Fix Decision Tree**

```
SonarQube Memory Issue Detected
    |
    +---> S1016 / S1029 (Memory Leak)?
    |         |
    |         +---> Is pointer allocated with 'new'? 
    |         |         YES -> Use Procedure A (smart pointer)
    |         |         NO  -> Check if POD type
    |         |                   POD -> vector<T>
    |         |                   Non-POD -> unique_ptr/shared_ptr
    |         |         
    |         +---> Is ownership UNIQUE? -> unique_ptr (ownership transfers on deletion)
    |         |         NO, SHARED? -> shared_ptr (multiple owners)
    |         |         NO, OBSERVING? -> gsl::not_null (non-owning)
    |
    +---> S5397 (Delete non-owning)?
    |         |
    |         +---> Trace pointer origin
    |         |         Allocated with 'new'? -> unique_ptr (makes you the owner)
    |         |         Assigned from other member? -> Remove delete (non-owning)
    |         |         
    +---> S1016 (Null deref)?
    |         |
    |         +---> Can pointer be NULL? 
    |         |         YES -> Use optional<T*> or optional<reference_wrapper<T>>
    |         |         NO  -> Use gsl::not_null<T*> or prefer references
    |
    +---> S3584 / S6072 (Buffer overflow / Pointer arithmetic)?
    |         |
    |         +---> Is it a C-style array? -> Use std::array or std::span
    |         |         Is it a string? -> Use std::string or std::string_view
    |         |         Pointer arithmetic? -> Use std::span (bounds-checked)
    |
    +---> Ambiguous ownership? 
              |         
              +---> STOP - Flag for manual review
                        Log: "MANUAL_REVIEW_REQUIRED"
                        Escalate to senior dev
```

---

**Summary of your Documentation Suite:**

* **Agent.md:** Your Senior C++ Lead (The "Who").  
* **Skill Memory.md:** Your Memory Remediation Manual (The "How" for memory issues).  
* **Workflow.md:** Your CI/CD Automation script (The "When" and execution path).
