import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  auth: false,
  preview: {
    buckets: {
      "question-papers": { access: "private" },
      "answer-keys": { access: "private" },
      "student-lists": { access: "private" },
      "question-lists": { access: "private" },
      "resources": { access: "private" },
      "backups": { access: "private" },
    },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      return { ttl: "7d" };
    }
    return {};
  },
});
