import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const leagueSetupSchema = z.object({
  name: z.string().min(2, "League name must be at least 2 characters"),
  city: z.string().optional(),
  state: z.string().optional(),
  type: z.enum(["SOFTBALL", "BASEBALL", "KICKBALL"]).optional(),
  planId: z.string().min(1, "Please select a plan"),
  couponCode: z.string().optional(),
});

export const seasonSchema = z.object({
  name: z.string().min(1, "Season name is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
});

export const teamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  categoryId: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type LeagueSetupInput = z.infer<typeof leagueSetupSchema>;
export type SeasonInput = z.infer<typeof seasonSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type TeamInput = z.infer<typeof teamSchema>;
