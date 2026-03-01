import { z } from "zod";
import { ImageCollection } from "./ImageMetadata";

export const CircleAnnotationSchema = z.object({
  type: z.literal("circle"),
  cx: z.number().min(0).max(1),
  cy: z.number().min(0).max(1),
  r: z.number().min(0).max(0.5),
  substep: z.number().int().min(0).optional(),
});

export const ArrowAnnotationSchema = z.object({
  type: z.literal("arrow"),
  x1: z.number().min(0).max(1),
  y1: z.number().min(0).max(1),
  x2: z.number().min(0).max(1),
  y2: z.number().min(0).max(1),
  substep: z.number().int().min(0).optional(),
});

export const AnnotationSchema = z.discriminatedUnion("type", [
  CircleAnnotationSchema,
  ArrowAnnotationSchema,
]);

export const TutorialPhotoSchema = z.object({
  filename: z.string(),
  alt: z.string(),
  annotations: z.array(AnnotationSchema).default([]),
});

export const SubStepSchema = z.object({
  text: z.string(),
});

export const TutorialStepSchema = z
  .object({
    title: z.string(),
    intro: z.string().optional(),
    substeps: z.array(SubStepSchema).default([]),
    photos: z.array(TutorialPhotoSchema).default([]),
  })
  .refine((step) => step.intro !== undefined || step.substeps.length > 0, {
    message: "Step must have at least one of: intro, substeps",
  });

export const TutorialSchema = z.object({
  id: z.string(),
  title: z.string(),
  manufacturer: z.string(),
  model: z.string(),
  description: z.string(),
  tools: z.array(z.string()),
  steps: z.array(TutorialStepSchema),
});

export type CircleAnnotation = z.infer<typeof CircleAnnotationSchema>;
export type ArrowAnnotation = z.infer<typeof ArrowAnnotationSchema>;
export type Annotation = z.infer<typeof AnnotationSchema>;
export type TutorialPhoto = z.infer<typeof TutorialPhotoSchema>;
export type SubStep = z.infer<typeof SubStepSchema>;
export type TutorialStep = z.infer<typeof TutorialStepSchema>;
export type Tutorial = z.infer<typeof TutorialSchema>;

// Types for tutorials after image processing in the Eleventy data pipeline
export type ProcessedPhoto = TutorialPhoto & {
  image: ImageCollection;
};

export type ProcessedStep = Omit<TutorialStep, "photos"> & {
  photos: ProcessedPhoto[];
};

export type ProcessedTutorial = Omit<Tutorial, "steps"> & {
  steps: ProcessedStep[];
};
