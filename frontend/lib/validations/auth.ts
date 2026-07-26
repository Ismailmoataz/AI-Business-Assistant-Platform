import {z} from "zod";
const email=z.email("Enter a valid email address");
const password=z.string().min(8,"Use at least 8 characters").max(128).regex(/[a-z]/,"Add a lowercase letter").regex(/[A-Z]/,"Add an uppercase letter").regex(/\d/,"Add a number").regex(/[^A-Za-z0-9]/,"Add a symbol");
export const loginSchema=z.object({email,password:z.string().min(1,"Enter your password")});
export const registerSchema=z.object({first_name:z.string().trim().min(1,"Required").max(100),last_name:z.string().trim().min(1,"Required").max(100),company_name:z.string().trim().min(2,"Use at least 2 characters").max(200),company_slug:z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,"Use lowercase letters, numbers, and hyphens"),email,password});
export const forgotSchema=z.object({email}); export const resetSchema=z.object({token:z.string().min(32,"Reset link is invalid"),password,confirmPassword:z.string()}).refine(d=>d.password===d.confirmPassword,{message:"Passwords do not match",path:["confirmPassword"]});
export type LoginValues=z.infer<typeof loginSchema>; export type RegisterValues=z.infer<typeof registerSchema>; export type ForgotValues=z.infer<typeof forgotSchema>; export type ResetValues=z.infer<typeof resetSchema>;
