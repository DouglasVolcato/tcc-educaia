import { userModel } from "../../../db/models/user.model.ts";
import { Application, Request, Response } from "express";
import { BaseController } from "../base.controller.ts";
import { InputField } from "../../../db/repository.ts";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateAccountSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome válido.").optional(),
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido.")
    .transform((value) => value.toLowerCase())
    .optional(),
  password: z
    .preprocess((value) => {
      if (typeof value !== "string") {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    }, z.string().min(6, "A senha deve ter ao menos 6 caracteres.").optional()),
});

export class AccountController extends BaseController {
  constructor(app: Application) {
    super(app);
  }

  protected registerRoutes(): void {
    this.router.put("/account", this.handleUpdateAccount);
    this.router.put("/account/preferences", this.handleUpdatePreferences);
  }

  private handleUpdateAccount = async (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const parsedBody = this.validate(updateAccountSchema, req.body ?? {});
    if (!parsedBody.success) {
      this.sendToastResponse(res, {
        status: 400,
        message: parsedBody.message,
        variant: "danger",
      });
      return;
    }

    const { name, email, password } = parsedBody.data;
    const updates: InputField[] = [];

    if (typeof name !== "undefined") {
      updates.push({ key: "name", value: name });
    }

    if (typeof email !== "undefined") {
      updates.push({ key: "email", value: email });
    }

    if (typeof password !== "undefined") {
      updates.push({ key: "password", value: await bcrypt.hash(password, 10) });
    }

    if (updates.length === 0) {
      this.sendToastResponse(res, {
        status: 200,
        message: "Nenhuma alteração foi aplicada ao seu perfil.",
        variant: "info",
      });
      return;
    }

    try {
      await userModel.update({ id: user.id, fields: updates });
      this.sendToastResponse(res, {
        status: 200,
        message: "Dados da conta atualizados com sucesso!",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to update account", error, res);
    }
  };

  private handleUpdatePreferences = async (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const preferencesSchema = z.object({
      reminderEmail: z.preprocess((value) => this.parseCheckbox(value), z.boolean()),
      reminderPush: z.preprocess((value) => this.parseCheckbox(value), z.boolean()),
      weeklySummary: z.preprocess((value) => this.parseCheckbox(value), z.boolean()),
      aiSuggestions: z.preprocess((value) => this.parseCheckbox(value), z.boolean()),
    });

    const parsedBody = this.validate(preferencesSchema, req.body ?? {});
    if (!parsedBody.success) {
      this.sendToastResponse(res, {
        status: 400,
        message: parsedBody.message,
        variant: "danger",
      });
      return;
    }

    const { reminderEmail, reminderPush, weeklySummary, aiSuggestions } = parsedBody.data;

    try {
      await userModel.update({
        id: user.id,
        fields: [
          { key: "reminder_email", value: reminderEmail },
          { key: "reminder_push", value: reminderPush },
          { key: "weekly_summary", value: weeklySummary },
          { key: "ai_suggestions", value: aiSuggestions },
        ],
      });

      this.sendToastResponse(res, {
        status: 200,
        message: "Preferências atualizadas com sucesso!",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to update preferences", error, res);
    }
  };
}
