// Task 6: Display the Full Application Board
use("job_tracker");

print("========================================");
print("        JOB APPLICATION BOARD          ");
print("========================================");

let count = 0;

db.job_applications.find().forEach(doc => {
    count++;
    print("\n[" + count + "] " + doc.company + "  |  " + doc.role + "  |  Status: " + doc.status);
    print("    Applied: " + doc.applied_date);

    if (doc.referral)       print("    Referral: "      + doc.referral);
    if (doc.salary_range)   print("    Salary Range: "  + doc.salary_range);
    if (doc.interview_note) print("    Note: "          + doc.interview_note);
});

print("\n========================================");
print("Total applications: " + count);
print("========================================");