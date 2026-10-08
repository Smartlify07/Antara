import { z } from "zod"

const emailSchema = z.email("Enter a valid email address")

export const loginSchema = z.object({
  email: emailSchema,
  // Min 1 on login: don't leak the password policy to unauthenticated users.
  password: z.string().min(1, "Enter your password"),
})

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be at most 100 characters"),
    email: emailSchema,
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>

export const resendSchema = z.object({
  email: emailSchema,
})

export type ResendInput = z.infer<typeof resendSchema>
