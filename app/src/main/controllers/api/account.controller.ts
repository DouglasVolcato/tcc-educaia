import { userModel } from "../../../db/models/user.model.ts";
import { Application, Request, Response } from "express";
import { BaseController } from "../base.controller.ts";
import { InputField } from "../../../db/repository.ts";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateAccountSchema = z
  .object({
    name: z.string().trim().min(1, "Informe um nome válido.").optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Informe um e-mail válido.")
      .optional(),
    password: z.string().trim().min(6, "A senha deve ter ao menos 6 caracteres.").optional(),
  })
  .refine((data) => data.name || data.email || data.password, {
    message: "Informe ao menos um campo para atualizar.",
  });

const updatePreferencesSchema = z.object({
  reminderEmail: z.boolean().default(false),
  reminderPush: z.boolean().default(false),
  weeklySummary: z.boolean().default(false),
  aiSuggestions: z.boolean().default(false),
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

    const payload = this.validate(updateAccountSchema, req.body ?? {}, res);
    if (!payload) {
      return;
    }

    const updates: InputField[] = [];

    if (payload.name) {
      updates.push({ key: "name", value: payload.name });
    }

    if (payload.email) {
      updates.push({ key: "email", value: payload.email });
    }

    if (payload.password) {
      updates.push({ key: "password", value: await bcrypt.hash(payload.password, 10) });
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

    const payload = this.validate(
      updatePreferencesSchema.transform((values) => ({
        reminderEmail: this.parseCheckbox(values.reminderEmail),
        reminderPush: this.parseCheckbox(values.reminderPush),
        weeklySummary: this.parseCheckbox(values.weeklySummary),
        aiSuggestions: this.parseCheckbox(values.aiSuggestions),
      })),
      req.body ?? {},
      res,
    );

    if (!payload) {
      return;
    }

    try {
      await userModel.update({
        id: user.id,
        fields: [
          { key: "reminder_email", value: payload.reminderEmail },
          { key: "reminder_push", value: payload.reminderPush },
          { key: "weekly_summary", value: payload.weeklySummary },
          { key: "ai_suggestions", value: payload.aiSuggestions },
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
