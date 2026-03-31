// Task 2: Insert Job Application Documents
use("job_tracker");

db.job_applications.insertOne({
    company:        "Stripe",
    role:           "Data Engineer",
    status:         "Interviewing",
    applied_date:   "2024-03-01",
    referral:       "Sara Malik"
});
print("Inserted 1 document via insertOne().");

db.job_applications.insertMany([
    {
        company:        "Notion",
        role:           "Backend Engineer",
        status:         "Applied",
        applied_date:   "2024-03-03",
        salary_range:   "$120k - $140k"
    },
    {
        company:        "Linear",
        role:           "Platform Engineer",
        status:         "Applied",
        applied_date:   "2024-03-05"
    },
    {
        company:        "Vercel",
        role:           "Site Reliability Engineer",
        status:         "Rejected",
        applied_date:   "2024-02-20",
        interview_note: "Completed two rounds, no offer extended."
    },
    {
        company:        "Figma",
        role:           "Data Analyst",
        status:         "Applied",
        applied_date:   "2024-03-07",
        salary_range:   "$110k - $130k",
        referral:       "James Owusu"
    }
]);
print("Inserted 4 documents via insertMany().");
print("Total documents in collection:", db.job_applications.countDocuments());