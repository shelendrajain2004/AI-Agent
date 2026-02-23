


**Skill Module: C++20 Memory & Resource Modernization**

## **Overview**

This module provides the logic for transforming legacy C++ manual resource management (pointers, file handles, C-style arrays) into modern, RAII-compliant C++20 structures. It focuses on resolving the most common SonarQube memory vulnerabilities.

## **SonarQube Memory Issues: Reference Map**

| SonarQube ID | Issue Type | Severity | C++20 Fix Category |
| :---- | :---- | :---- | :---- |
| S1016 | Memory leak on non-POD object | Blocker | Smart Pointer |
| S1029 | Memory leak on POD object | Critical | Smart Pointer / Arena |
| S2095 | P: Creating an object without assigning it or using its value | Major | Smart Pointer |
| S2996 | Custom operator new without custom operator delete | Major | Use std::make\_unique |
| S3584 | Buffer overflow in array access | Blocker | std::array / std::span |
| S5356 | Unsafe pointer cast | Critical | Type-safe patterns |
| S5397 | Delete non-owning pointer | Blocker | Ownership analysis |
| S6072 | Unsafe pointer arithmetic | Critical | std::span / ranges |

## **Logic Flow: Resource Remediation**

### **1\. Identify Ownership Pattern** (Decision Tree)

Before applying a fix, perform the following checks in order:

**Step 1: Is the pointer created with `new`?**
  - YES → Owner (likely should be smart pointer)
  - NO → Check Step 2

**Step 2: Is the pointer assigned from another object's member?**
  - YES → Non-owning or shared (check Step 3)
  - NO → Check Step 3

**Step 3: Is the pointer passed to a function that deletes it?**
  - YES → Shared ownership (std::shared\_ptr with careful use)
  - NO → Non-owning (use std::optional\<T&\> or gsl::not\_null)

Ownership Classification:

* **Unique Ownership:** Resource is created with `new` and deleted in the same class destructor only. → **Use std::unique\_ptr\<T\>**
* **Shared Ownership:** Resource lifecycle is managed by multiple objects (e.g., observer patterns, circular dependencies). → **Use std::shared\_ptr\<T\> with weak\_ptr analysis**
* **Non-Owning:** The pointer is used only for access/observation (borrowed reference). → **Use std::optional\<T&\> or gsl::not\_null\<T*\>**

### **2\. Transformation Rules with Code Examples**

| Legacy Pattern | SonarQube ID | C++20 Remediation Skill | Example |
| :---- | :---- | :---- | :---- |
| new / delete in constructor/destructor | S1016, S1029 | std::unique\_ptr + std::make\_unique | `unique_ptr<Widget> w = make_unique<Widget>();` |
| malloc / free in legacy C code | S1029 | std::vector or std::array | `vector<int> v(size);` or `array<int, 10> a;` |
| Raw pointer return from function | S2095, S5397 | std::unique\_ptr return type | `unique_ptr<Database> createDB() { return make_unique<Database>(); }` |
| Raw pointer function parameters | S1016, S5397 | std::optional\<T&\>, gsl::not\_null, or const T* | `void process(std::optional<Widget&> w)` or `void process(gsl::not_null<Widget*> w)` |
| Manual pointer ownership tracking | S1016, S2095 | std::make\_shared\<T\> for shared cases | `shared_ptr<Resource> r = make_shared<Resource>();` |
| C-style Array (char[256]) | S3584, S5356 | std::array or std::string | `array<char, 256> buffer;` or `string buffer;` |
| Pointer arithmetic (ptr + offset) | S6072 | std::span\<T\> with views | `span<int> view(data, size);` |
| Manual lock/unlock pairs | S1016 | std::scoped\_lock or std::unique\_lock | `scoped_lock lk(mutex);` (RAII automatic unlock) |

## **Technical Procedures**

### **Procedure A: Smart Pointer Conversion (S1016, S1029, S2095)**

**When to apply:** SonarQube flags a raw pointer with `new`/`delete` in a class.

1. **Locate** all `delete` statements for the pointer.  
2. **Determine ownership** using the Decision Tree (Section 2.1).  
3. **If Unique Ownership:**  
   - Replace member variable: `T* ptr;` → `std::unique_ptr<T> ptr;`  
   - Replace allocation: `ptr = new T();` → `ptr = std::make_unique<T>();`  
   - **Remove** the explicit `delete ptr;` in destructor.  
4. **If Shared Ownership:**  
   - Replace: `T* ptr;` → `std::shared_ptr<T> ptr;`  
   - Check for **circular references** (Use `weak_ptr` if needed)  
5. **Verify:**  
   - No `ptr.get()` calls in unsafe scopes  
   - No manual `delete` calls remain  

**Code Example:**
```cpp
// BEFORE (S1016: Memory leak)
class Database {
    Connection* conn;
public:
    Database() { conn = new Connection(); }
    ~Database() { delete conn; }
};

// AFTER (C++20 Safe)
class Database {
    std::unique_ptr<Connection> conn;
public:
    Database() : conn(std::make_unique<Connection>()) {}
    // Destructor automatically called
};
```

### **Procedure B: Null Pointer Dereference Protection (S1016, S5397)**

**When to apply:** SonarQube flags a raw pointer parameter with potential null dereference.

1. **Identify** the pointer parameter: `void process(Widget* w)`  
2. **Check** if null is ever valid:  
   - **NULL is NEVER valid** → Use `gsl::not_null<Widget*>` (requires GSL include)  
   - **NULL is sometimes valid** → Use `std::optional<Widget*>` or `std::optional<std::reference_wrapper<Widget>>`  
3. **Refactor:**  
```cpp
// BEFORE (S1016: Potential null dereference)
void process(Widget* w) { w->update(); }  // Undefined if w == nullptr

// AFTER (Option 1: Non-null contracts)
#include <gsl/pointers>
void process(gsl::not_null<Widget*> w) { w->update(); }

// AFTER (Option 2: Optional handling)
void process(std::optional<Widget*> w) {
    if (w) { (*w)->update(); }
}

// AFTER (Option 3: Reference)
void process(Widget& w) { w.update(); }  // Preferred when null is never valid
```

### **Procedure C: C-Style Array & Buffer Overflow (S3584, S6072)**

**When to apply:** SonarQube flags array bounds violations or unsafe pointer arithmetic.

1. **Identify** the C-style array: `char buffer[256];`  
2. **Determine the size:**  
   - **Fixed size** → Use `std::array<char, 256>`  
   - **Dynamic size** → Use `std::vector<char>` or `std::string`  
   - **View of existing data** → Use `std::span<char>`  

**Code Example:**
```cpp
// BEFORE (S3584: Buffer overflow risk)
char buffer[256];
strcpy(buffer, user_input);  // No bounds check!

// AFTER (Safe with std::array)
std::array<char, 256> buffer;
std::string input(user_input);
if (input.size() < buffer.size()) {
    std::copy(input.begin(), input.end(), buffer.begin());
}

// BETTER (Use std::string)
std::string buffer = user_input;  // Automatic size management
```

### **Procedure D: String Safety (S3584 in strings)**

**When to apply:** SonarQube flags unsafe string operations (strcpy, strcat, sprintf).

1. **Identify:** `char*` or `const char*` string operations  
2. **For owned strings** → Use `std::string`  
3. **For string views (read-only)** → Use `std::string_view`  

**Code Example:**
```cpp
// BEFORE (S3584: Unsafe string operation)
char buffer[256];
const char* input = get_user_input();
strcpy(buffer, input);  // No bounds!
strcat(buffer, " - processed");  // Potential overflow!

// AFTER (Safe)
std::string buffer = get_user_input();
buffer += " - processed";  // Safe, auto-sizing
```

## **Constraints & Safety Checks**

* **No Circular Refs:** If using `std::shared_ptr`, the agent must analyze for circular dependencies:
  - Parent holds `shared_ptr<Child>`  
  - Child holds `shared_ptr<Parent>` → **MEMORY LEAK**  
  - **Fix:** Child should hold `std::weak_ptr<Parent>` instead  

* **Binary Compatibility:** Do not change public header signatures if the project requires ABI stability:
  - Changing `void foo(T* ptr)` to `void foo(unique_ptr<T> ptr)` breaks ABI  
  - **Flag for manual review** if this is a public C++ API  
  
* **Exception Safety:** Ensure RAII migration preserves exception-safety level:
  - **No-throw guarantee:** `std::move` operations must not throw  
  - **Strong guarantee:** Rollback state on exception (RAII helps here)  
  - **Weak/Basic guarantee:** State may be partially modified (acceptable in most cases)  

* **Performance Regression Check:** Verify no unexpected allocations:
  - `std::make_unique` allocates on heap (use `std::make_unique` not separate `new`)  
  - `std::string` vs `std::string_view` (view is zero-copy)  
  - `std::span` vs `std::vector` (span is zero-copy view)

## **Validation Steps (Post-Fix Verification)**

### **Step 1: Compiler Type-Safety Check**
```bash
# Ensure fix compiles with strict flags
g++ -std=c++20 -Werror -Wall -Wextra -fsanitize=address -fsanitize=undefined <file.cpp>
```
- **Goal:** Catch type mismatches, double-deletes, and use-after-free at compile time  

### **Step 2: Static Analysis with Clang-Tidy**
```bash
clang-tidy -checks='modernize-*,cppcoreguidelines-*,readability-*' <file.cpp> -- -std=c++20
```
- **Focus on:** `modernize-use-unique-ptr`, `cppcoreguidelines-owning-memory`, `readability-simplify-boolean-expr`  

### **Step 3: Memory Sanitizer (ASan/MSan)**
```bash
g++ -std=c++20 -fsanitize=address -fsanitize=leak ./test.cpp
./a.out  # Must produce no "LeakSanitizer" warnings
```
- **Goal:** Detect heap overflows, use-after-free, memory leaks at runtime  

### **Step 4: SonarQube Rescanning**
```bash
sonar-scanner -Dsonar.projectKey=my-project
```
- **Verify:** Original SonarQube Issue ID is **RESOLVED** (not just "Commented Out")  

### **Step 5: Unit Tests for the Fixed Module**
```bash
boost_test_runner --run_test=MemoryTests
```
- **Coverage:** 100% of changed code paths  
- **Confirm:** Functional behavior unchanged (regression test)  

### **Step 6: Code Review Checklist for Reviewer**
- [ ] No `delete` calls remain in fixed scope  
- [ ] All `new` have corresponding `make_unique/make_shared`  
- [ ] No `ptr.get()` leaked to an unsafe scope  
- [ ] Ownership semantics clearly documented (unique vs shared)  
- [ ] No circular `shared_ptr` dependencies  
- [ ] Exception safety preserved or improved

---

