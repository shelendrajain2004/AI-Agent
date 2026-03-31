use("job_tracker");

print("Connected to database:", db.getName());

db.createCollection("job_applications");
print("Collection 'job_applications' is ready.");
