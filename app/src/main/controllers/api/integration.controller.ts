import { Application, Request, Response } from "express";
import { z } from "zod";
import { BaseController } from "../base.controller.ts";
import { integrationModel } from "../../../db/models/integration.model.ts";

export class IntegrationController extends BaseController {
  constructor(app: Application) {
    super(app);
  }

  protected registerRoutes(): void {
    this.router.put("/integrations/:integrationId", this.handleUpdateIntegration);
  }

  private handleUpdateIntegration = async (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const paramsValidation = this.validate(
      z.object({
        integrationId: z.string().trim().uuid("Integração inválida."),
      }),
      req.params,
    );
    if (!paramsValidation.success) {
      this.sendToastResponse(res, {
        status: 400,
        message: paramsValidation.message,
        variant: "danger",
      });
      return;
    }

    const bodyValidation = this.validate(
      z.object({
        connected: z.preprocess((value) => this.parseCheckbox(value), z.boolean()),
        name: z.string().trim().min(1, "Informe um nome válido.").optional(),
      }),
      req.body ?? {},
    );
    if (!bodyValidation.success) {
      this.sendToastResponse(res, {
        status: 400,
        message: bodyValidation.message,
        variant: "danger",
      });
      return;
    }

    const { integrationId } = paramsValidation.data;
    const { connected, name } = bodyValidation.data;

    try {
      const integration = await integrationModel.findOne({
        params: [
          { key: "id", value: integrationId },
          { key: "user_id", value: user.id },
        ],
      });

      if (!integration) {
        this.sendToastResponse(res, {
          status: 404,
          message: "Integração não encontrada.",
          variant: "danger",
        });
        return;
      }

      await integrationModel.update({
        id: integrationId,
        fields: [
          { key: "connected", value: connected },
          { key: "name", value: name ?? integration.name },
        ],
      });

      this.sendToastResponse(res, {
        status: 200,
        message: "Integração atualizada com sucesso!",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to update integration", error, res);
    }
  };
}
