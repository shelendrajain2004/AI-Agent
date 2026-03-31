// Task 3: Query Applications by Status
use("job_tracker");

print("\n--- Applications with status: Applied ---");
const applied = db.job_applications.find({ status: "Applied" });
applied.forEach(doc => {
    print(doc.company, "|", doc.role, "|", doc.applied_date);
});

print("\n--- Applications with status: Interviewing ---");
const interviewing = db.job_applications.find({ status: "Interviewing" });
interviewing.forEach(doc => {
    print(doc.company, "|", doc.role, "|", doc.applied_date);
});