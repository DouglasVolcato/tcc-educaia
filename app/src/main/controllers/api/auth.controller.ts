import { Application, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { BaseController } from "../base.controller.ts";
import { usersModel } from "../../../db/models/users-model.ts";
import { UuidGeneratorAdapter } from "../../../adapters/uuid-generator-adapter.ts";

const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "Informe seu primeiro nome."),
    lastName: z.string().trim().min(1, "Informe seu sobrenome."),
    email: z
      .string()
      .trim()
      .min(1, "Informe seu e-mail.")
      .email("Informe um e-mail válido.")
      .transform((value) => value.toLowerCase()),
    password: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
    confirmPassword: z.string().min(6, "Confirme sua senha com ao menos 6 caracteres."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas informadas não conferem.",
    path: ["confirmPassword"],
  });

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail.")
    .email("Informe um e-mail válido.")
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Informe sua senha."),
});

export class AuthController extends BaseController {
  constructor(app: Application) {
    super(app, { requiresAuth: false });
  }

  protected registerRoutes(): void {
    this.router.post("/auth/register", this.handleRegister);
    this.router.post("/auth/login", this.handleLogin);
  }

  private handleRegister = async (req: Request, res: Response) => {
    const parsedBody = this.validate(registerSchema, req.body ?? {});
    if (!parsedBody.success) {
      this.sendToastResponse(res, {
        status: 400,
        message: parsedBody.message,
        variant: "danger",
      });
      return;
    }

    const { firstName, lastName, email, password } = parsedBody.data;
    const normalizedEmail = email;

    try {
      const existingUser = await usersModel.findByEmail(normalizedEmail);
      if (existingUser) {
        this.sendToastResponse(res, {
          status: 409,
          message: "Já existe uma conta utilizando este e-mail.",
          variant: "danger",
        });
        return;
      }

      const hashedPassword = await bcrypt.hash(String(password), 10);
      const id = UuidGeneratorAdapter.generate();

      await usersModel.createUser({
        id,
        name: `${String(firstName).trim()} ${String(lastName).trim()}`.trim(),
        email: normalizedEmail,
        password: hashedPassword,
      });

      const token = this.getJwtAdapter().generateToken({ userId: id });
      this.setSessionCookie(res, token);
      res.setHeader("HX-Redirect", "/app/decks");

      this.sendToastResponse(res, {
        status: 201,
        message: "Conta criada com sucesso! Redirecionando...",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to register user", error);
      this.sendToastResponse(res, {
        status: 500,
        message: "Não foi possível criar sua conta. Tente novamente em instantes.",
        variant: "danger",
      });
    }
  };

  private handleLogin = async (req: Request, res: Response) => {
    const parsedBody = this.validate(loginSchema, req.body ?? {});
    if (!parsedBody.success) {
      this.sendToastResponse(res, {
        status: 400,
        message: parsedBody.message,
        variant: "danger",
      });
      return;
    }

    const { email, password } = parsedBody.data;
    const normalizedEmail = email;

    try {
      const user = await usersModel.findByEmail(normalizedEmail);
      if (!user) {
        this.sendToastResponse(res, {
          status: 401,
          message: "Credenciais inválidas.",
          variant: "danger",
        });
        return;
      }

      const isValidPassword = await bcrypt.compare(String(password), user.password);
      if (!isValidPassword) {
        this.sendToastResponse(res, {
          status: 401,
          message: "Credenciais inválidas.",
          variant: "danger",
        });
        return;
      }

      const token = this.getJwtAdapter().generateToken({ userId: user.id });
      this.setSessionCookie(res, token);
      res.setHeader("HX-Redirect", "/app/decks");

      this.sendToastResponse(res, {
        status: 200,
        message: "Login realizado com sucesso! Redirecionando...",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to authenticate user", error);
      this.sendToastResponse(res, {
        status: 500,
        message: "Não foi possível acessar sua conta. Tente novamente em instantes.",
        variant: "danger",
      });
    }
  };
}
