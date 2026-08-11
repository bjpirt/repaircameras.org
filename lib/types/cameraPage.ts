import { z } from "zod";

export const TroubleshootingEntrySchema = z.object({
  symptom: z.string().min(1, "Symptom is required"),
  cause: z.string().min(1, "Cause is required"),
  solution: z.string().min(1, "Solution is required"),
});

export const CameraPageSchema = z.object({
  manufacturer: z.string().min(1, "Manufacturer is required"),
  model: z.string().min(1, "Model is required"),
  body: z.string(),
  relatedFiles: z.array(z.string()),
  relatedLinks: z.array(z.string()),
  // Files hosted on the Internet Archive (site/_data/ia/{id}.json). Not yet
  // editable in the admin UI, but carried through saves so edits don't drop it.
  relatedArchives: z.array(z.string()).default([]),
  troubleshooting: z.array(TroubleshootingEntrySchema),
});

export type TroubleshootingEntry = z.infer<typeof TroubleshootingEntrySchema>;
export type CameraPage = z.infer<typeof CameraPageSchema>;
