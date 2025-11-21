import { Application, Request, Response } from "express";
import { BaseController } from "../base.controller.ts";
import { deckModel } from "../../../db/models/deck.model.ts";
import { flashcardModel, FlashcardRow } from "../../../db/models/flashcard.model.ts";
import { InputField } from "../../../db/repository.ts";
import { UuidGeneratorAdapter } from "../../../adapters/uuid-generator-adapter.ts";
import { DeckCardGeneratorService } from "../../../ai/deck-card-generator.service.ts";
import { z } from "zod";

export class DecksController extends BaseController {
  private readonly cardGenerator: DeckCardGeneratorService;

  constructor(app: Application) {
    super(app);
    this.cardGenerator = new DeckCardGeneratorService();
  }

  private getDeckParamsSchema() {
    return z.object({
      deckId: z.string().uuid("Baralho não encontrado."),
    });
  }

  private getCardParamsSchema() {
    return z.object({
      deckId: z.string().uuid("Baralho não encontrado."),
      cardId: z.string().uuid("Carta não encontrada."),
    });
  }

  private getDeckPayloadSchema(requireNameAndSubject = false) {
    const baseSchema = z.object({
      name: z.string().trim().min(1, "O nome do baralho não pode ficar em branco.").optional(),
      description: z
        .string()
        .trim()
        .optional()
        .transform((value) => (value && value.length > 0 ? value : null)),
      subject: z.string().trim().min(1, "Informe o assunto do baralho.").optional(),
      tags: this.buildTagsSchema({ defaultEmpty: requireNameAndSubject }),
    });

    if (!requireNameAndSubject) {
      return baseSchema;
    }

    return baseSchema.superRefine((values, ctx) => {
      if (!values.name) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "O nome do baralho não pode ficar em branco." });
      }

      if (!values.subject) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe o assunto do baralho." });
      }
    });
  }

  private getCardCreationSchema() {
    return z.object({
      question: z.string().trim().min(1, "Informe a pergunta para criar a carta."),
      answer: z.string().trim().min(1, "Informe a resposta para criar a carta."),
      difficulty: this.buildDifficultySchema(),
      tags: this.buildTagsSchema(),
    });
  }

  private getCardUpdateSchema() {
    return z.object({
      question: z.string().trim().min(1, "A pergunta não pode ficar vazia.").optional(),
      answer: z.string().trim().min(1, "A resposta não pode ficar vazia.").optional(),
      difficulty: this.buildDifficultySchema({ defaultToMedium: false }),
      tags: this.buildTagsSchema({ defaultEmpty: false }),
      nextReviewDate: z
        .string()
        .datetime({ message: "Informe uma data válida para a próxima revisão." })
        .optional()
        .transform((value) => (value ? new Date(value) : undefined)),
    });
  }

  private getCardGenerationSchema() {
    return z.object({
      content: z.string().trim().min(1, "Cole algum conteúdo para gerar sugestões."),
      goal: z.string().trim().optional().transform((value) => (value && value.length > 0 ? value : null)),
      tone: z
        .enum(["concise", "standard", "deep"])
        .optional()
        .transform((value) => this.normalizeTone(value)),
    });
  }

  protected registerRoutes(): void {
    this.router.post("/decks", this.handleCreateDeck);
    this.router.put("/decks/:deckId", this.handleUpdateDeck);
    this.router.delete("/decks/:deckId", this.handleDeleteDeck);
    this.router.post("/decks/:deckId/cards", this.handleCreateCard);
    this.router.put("/decks/:deckId/cards/:cardId", this.handleUpdateCard);
    this.router.delete("/decks/:deckId/cards/:cardId", this.handleDeleteCard);
    this.router.post("/decks/:deckId/cards/:cardId/move-to-review", this.handleMoveCardToReview);
    this.router.post("/decks/:deckId/generate", this.handleGenerateCards);
  }

  private ensureDeckBelongsToUser(deckId: string, userId: string) {
    return deckModel.findOne({
      params: [
        { key: "id", value: deckId },
        { key: "user_id", value: userId },
      ],
    });
  }

  private handleCreateDeck = async (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const payload = this.validate(this.getDeckPayloadSchema(true), req.body ?? {}, res);
    if (!payload) {
      return;
    }

    try {
      await deckModel.insert({
        fields: [
          { key: "id", value: UuidGeneratorAdapter.generate() },
          { key: "name", value: payload.name ?? null },
          { key: "description", value: payload.description ?? null },
          { key: "subject", value: payload.subject ?? null },
          { key: "tags", value: payload.tags ?? [] },
          { key: "user_id", value: user.id },
        ],
      });

      this.sendToastResponse(res, {
        status: 201,
        message: "Baralho criado com sucesso! Atualize a página para visualizar as mudanças.",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to create deck", error, res);
    }
  };

  private handleUpdateDeck = async (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const params = this.validate(this.getDeckParamsSchema(), req.params, res);
    if (!params) {
      return;
    }

    try {
      const deck = await this.ensureDeckBelongsToUser(params.deckId, user.id);
      if (!deck) {
        this.sendToastResponse(res, {
          status: 404,
          message: "Baralho não encontrado.",
          variant: "danger",
        });
        return;
      }

      const payload = this.validate(this.getDeckPayloadSchema(), req.body ?? {}, res);
      if (!payload) {
        return;
      }
      const updates: InputField[] = [];

      if (payload.name !== undefined) {
        updates.push({ key: "name", value: payload.name });
      }

      if (payload.description !== undefined) {
        updates.push({ key: "description", value: payload.description });
      }

      if (payload.subject !== undefined) {
        updates.push({ key: "subject", value: payload.subject });
      }

      if (payload.tags !== undefined) {
        updates.push({ key: "tags", value: payload.tags });
      }

      if (updates.length === 0) {
        this.sendToastResponse(res, {
          status: 200,
          message: "Nenhuma alteração foi enviada para este baralho.",
          variant: "info",
        });
        return;
      }

      await deckModel.update({
        id: params.deckId,
        fields: updates,
      });

      this.sendToastResponse(res, {
        status: 200,
        message: "Baralho atualizado com sucesso!",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to update deck", error, res);
    }
  };

  private handleDeleteDeck = async (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const params = this.validate(this.getDeckParamsSchema(), req.params, res);
    if (!params) {
      return;
    }
    try {
      const deck = await this.ensureDeckBelongsToUser(params.deckId, user.id);
      if (!deck) {
        this.sendToastResponse(res, {
          status: 404,
          message: "Baralho não encontrado.",
          variant: "danger",
        });
        return;
      }

      await flashcardModel.delete({
        params: [
          { key: "deck_id", value: params.deckId },
          { key: "user_id", value: user.id },
        ],
      });

      await deckModel.delete({
        params: [
          { key: "id", value: params.deckId },
          { key: "user_id", value: user.id },
        ],
      });

      this.sendToastResponse(res, {
        status: 200,
        message: "Baralho removido com sucesso.",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to delete deck", error, res);
    }
  };

  private handleCreateCard = async (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const params = this.validate(this.getDeckParamsSchema(), req.params, res);
    if (!params) {
      return;
    }

    const payload = this.validate(this.getCardCreationSchema(), req.body ?? {}, res);
    if (!payload) {
      return;
    }

    try {
      const deck = await this.ensureDeckBelongsToUser(params.deckId, user.id);
      if (!deck) {
        this.sendToastResponse(res, {
          status: 404,
          message: "Baralho não encontrado.",
          variant: "danger",
        });
        return;
      }

      await flashcardModel.insert({
        fields: [
          { key: "id", value: UuidGeneratorAdapter.generate() },
          { key: "question", value: payload.question },
          { key: "answer", value: payload.answer },
          { key: "user_id", value: user.id },
          { key: "deck_id", value: params.deckId },
          { key: "status", value: "new" },
          { key: "review_count", value: 0 },
          { key: "last_review_date", value: null },
          { key: "difficulty", value: payload.difficulty },
          { key: "tags", value: payload.tags ?? [] },
        ],
      });

      this.sendToastResponse(res, {
        status: 201,
        message: "Carta criada com sucesso!",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to create card", error, res);
    }
  };

  private handleUpdateCard = async (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const params = this.validate(this.getCardParamsSchema(), req.params, res);
    if (!params) {
      return;
    }

    const payload = this.validate(this.getCardUpdateSchema(), req.body ?? {}, res);
    if (!payload) {
      return;
    }

    try {
      const card = (await flashcardModel.findOne({
        params: [
          { key: "id", value: params.cardId },
          { key: "deck_id", value: params.deckId },
          { key: "user_id", value: user.id },
        ],
      })) as FlashcardRow | null;

      if (!card) {
        this.sendToastResponse(res, {
          status: 404,
          message: "Carta não encontrada.",
          variant: "danger",
        });
        return;
      }

      const updates: InputField[] = [];

      if (payload.question !== undefined) {
        updates.push({ key: "question", value: payload.question });
      }

      if (payload.answer !== undefined) {
        updates.push({ key: "answer", value: payload.answer });
      }

      if (payload.difficulty !== undefined) {
        updates.push({ key: "difficulty", value: payload.difficulty });
      }

      if (payload.tags !== undefined) {
        updates.push({ key: "tags", value: payload.tags });
      }

      if (payload.nextReviewDate !== undefined) {
        const parsedDate = payload.nextReviewDate ?? new Date();
        updates.push({ key: "next_review_date", value: parsedDate.toISOString() });
      }

      if (updates.length === 0) {
        this.sendToastResponse(res, {
          status: 200,
          message: "Nenhuma alteração foi aplicada nesta carta.",
          variant: "info",
        });
        return;
      }

      await flashcardModel.update({ id: params.cardId, fields: updates });

      this.sendToastResponse(res, {
        status: 200,
        message: "Carta atualizada com sucesso!",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to update card", error, res);
    }
  };

  private handleMoveCardToReview = async (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const params = this.validate(this.getCardParamsSchema(), req.params, res);
    if (!params) {
      return;
    }

    try {
      const card = await flashcardModel.findOne({
        params: [
          { key: "id", value: params.cardId },
          { key: "deck_id", value: params.deckId },
          { key: "user_id", value: user.id },
        ],
      });

      if (!card) {
        this.sendToastResponse(res, {
          status: 404,
          message: "Carta não encontrada.",
          variant: "danger",
        });
        return;
      }

      await flashcardModel.updateNextReviewDateToNow(params.cardId);

      res
        .status(200)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send(`
          <span class="badge text-bg-warning d-inline-flex align-items-center gap-1">
            <i class="bi bi-exclamation-triangle-fill"></i>
            Revisão pendente
          </span>
        `);
      return;
    } catch (error) {
      this.handleUnexpectedError("Erro ao mover carta para revisão", error, res);
    }
  };

  private handleDeleteCard = async (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const params = this.validate(this.getCardParamsSchema(), req.params, res);
    if (!params) {
      return;
    }

    try {
      const card = await flashcardModel.findOne({
        params: [
          { key: "id", value: params.cardId },
          { key: "deck_id", value: params.deckId },
          { key: "user_id", value: user.id },
        ],
      });

      if (!card) {
        this.sendToastResponse(res, {
          status: 404,
          message: "Carta não encontrada.",
          variant: "danger",
        });
        return;
      }

      await flashcardModel.delete({
        params: [
          { key: "id", value: params.cardId },
          { key: "deck_id", value: params.deckId },
          { key: "user_id", value: user.id },
        ],
      });

      this.sendToastResponse(res, {
        status: 200,
        message: "Carta removida com sucesso.",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to delete card", error, res);
    }
  };

  private handleGenerateCards = async (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const params = this.validate(this.getDeckParamsSchema(), req.params, res);
    if (!params) {
      return;
    }

    const payload = this.validate(this.getCardGenerationSchema(), req.body ?? {}, res);
    if (!payload) {
      return;
    }

    try {
      const deck = await this.ensureDeckBelongsToUser(params.deckId, user.id);
      if (!deck) {
        res
          .status(404)
          .setHeader("Content-Type", "text/html; charset=utf-8")
          .send('<div class="alert alert-danger" role="alert">Baralho não encontrado.</div>');
        return;
      }

      const cards = await this.generateCardsWithFallback({
        deckName: deck.name,
        deckSubject: deck.subject ?? "Geral",
        content: payload.content,
        goal: payload.goal,
        tone: payload.tone,
      });

      for (const suggestion of cards) {
        await flashcardModel.insert({
          fields: [
            { key: "id", value: UuidGeneratorAdapter.generate() },
            { key: "question", value: suggestion.question },
            { key: "answer", value: suggestion.answer },
            { key: "user_id", value: user.id },
            { key: "deck_id", value: params.deckId },
            { key: "status", value: "new" },
            { key: "review_count", value: 0 },
            { key: "last_review_date", value: null },
            { key: "difficulty", value: suggestion.difficulty ?? "medium" },
            { key: "tags", value: suggestion.tags ?? [] },
          ],
        });
      }

      res
        .status(201)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send(this.buildCardPreviewMarkup(deck.id, cards));
    } catch (error) {
      console.error("Failed to generate AI suggestion", error);
      res
        .status(500)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send('<div class="alert alert-danger" role="alert">Não foi possível gerar sugestões no momento. Tente novamente mais tarde.</div>');
    }
  };

  private async generateCardsWithFallback(input: {
    deckName: string;
    deckSubject: string;
    content: string;
    goal?: string | null;
    tone?: "concise" | "standard" | "deep";
  }) {
    const result = await this.cardGenerator.generateCards(input);
    if (result.cards.length > 0) {
      return result.cards;
    } else {
      throw new Error("Erro ao gerar flashcards.");
    }
  }

  private normalizeTone(value: unknown): "concise" | "standard" | "deep" {
    if (value === "concise" || value === "deep") {
      return value;
    }
    return "standard";
  }
}
