// Task 4: Update an Application's Status
use("job_tracker");

const result = db.job_applications.updateOne(
    { company: "Notion" },
    { $set: { status: "Interviewing" } }
);

print("Documents matched: ", result.matchedCount);
print("Documents updated: ", result.modifiedCount);

const updated = db.job_applications.findOne({ company: "Notion" });
print("\nUpdated document:");
print("  Company:", updated.company);
print("  Role:   ", updated.role);
print("  Status: ", updated.status);