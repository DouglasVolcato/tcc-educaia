import { Application, Request, Response } from "express";
import { BaseController } from "../base.controller.ts";
import { integrationModel } from "../../../db/models/integration.model.ts";
import { z } from "zod";

const integrationParamsSchema = z.object({
  integrationId: z.string().uuid("Identificador de integração inválido."),
});

const integrationBodySchema = z.object({
  connected: z.boolean().default(false),
  name: z.string().trim().min(1, "Informe um nome para a integração.").optional(),
});

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

    const params = this.validate(integrationParamsSchema, req.params, res);
    if (!params) {
      return;
    }

    const payload = this.validate(
      integrationBodySchema.transform((values) => ({
        connected: this.parseCheckbox(values.connected),
        name: values.name,
      })),
      req.body ?? {},
      res,
    );

    if (!payload) {
      return;
    }

    try {
      const integration = await integrationModel.findOne({
        params: [
          { key: "id", value: params.integrationId },
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
        id: params.integrationId,
        fields: [
          { key: "connected", value: payload.connected },
          { key: "name", value: payload.name ?? integration.name },
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
