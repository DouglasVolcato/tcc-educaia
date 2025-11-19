import { Application, Request, Response } from "express";
import { z } from "zod";
import { BaseController } from "../base.controller.ts";
import { deckModel } from "../../../db/models/deck.model.ts";
import { flashcardModel, FlashcardRow } from "../../../db/models/flashcard.model.ts";
import { InputField } from "../../../db/repository.ts";
import { UuidGeneratorAdapter } from "../../../adapters/uuid-generator-adapter.ts";

export class DecksController extends BaseController {
  constructor(app: Application) {
    super(app);
  }

  protected registerRoutes(): void {
    this.router.post("/decks", this.handleCreateDeck);
    this.router.put("/decks/:deckId", this.handleUpdateDeck);
    this.router.delete("/decks/:deckId", this.handleDeleteDeck);
    this.router.post("/decks/:deckId/cards", this.handleCreateCard);
    this.router.put("/decks/:deckId/cards/:cardId", this.handleUpdateCard);
    this.router.delete("/decks/:deckId/cards/:cardId", this.handleDeleteCard);
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

    const schema = z.object({
      name: z.string().trim().min(1, "Informe o nome do baralho."),
      description: z.string().trim().optional(),
      subject: z.string().trim().min(1, "Informe o assunto do baralho."),
      tags: z.preprocess((value) => this.parseTags(value), z.array(z.string())),
    });

    const validation = this.validate(schema, req.body ?? {});
    if (!validation.success) {
      this.sendToastResponse(res, {
        status: 400,
        message: validation.message,
        variant: "danger",
      });
      return;
    }

    const { name, description, subject, tags } = validation.data;
    const normalizedDescription = description && description.length > 0 ? description : null;

    try {
      await deckModel.insert({
        fields: [
          { key: "id", value: UuidGeneratorAdapter.generate() },
          { key: "name", value: name },
          { key: "description", value: normalizedDescription },
          { key: "subject", value: subject },
          { key: "tags", value: tags },
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

    const paramsValidation = this.validate(
      z.object({ deckId: z.string().trim().uuid("Baralho inválido.") }),
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

    const schema = z.object({
      name: z.string().trim().min(1, "O nome do baralho não pode ficar em branco.").optional(),
      description: z
        .string()
        .trim()
        .transform((value) => (value.length === 0 ? null : value))
        .optional(),
      subject: z.string().trim().min(1, "O assunto do baralho não pode ficar em branco.").optional(),
      tags: z
        .preprocess((value) => {
          if (typeof value === "undefined") {
            return undefined;
          }
          return this.parseTags(value);
        }, z.array(z.string()))
        .optional(),
    });

    const validation = this.validate(schema, req.body ?? {});
    if (!validation.success) {
      this.sendToastResponse(res, {
        status: 400,
        message: validation.message,
        variant: "danger",
      });
      return;
    }

    const { deckId } = paramsValidation.data;
    const { name, description, subject, tags } = validation.data;
    
    try {
      const deck = await this.ensureDeckBelongsToUser(deckId, user.id);
      if (!deck) {
        this.sendToastResponse(res, {
          status: 404,
          message: "Baralho não encontrado.",
          variant: "danger",
        });
        return;
      }

      const updates: InputField[] = [];

      if (typeof name !== "undefined") {
        updates.push({ key: "name", value: name });
      }

      if (typeof description !== "undefined") {
        updates.push({ key: "description", value: description });
      }

      if (typeof subject !== "undefined") {
        updates.push({ key: "subject", value: subject });
      }

      if (typeof tags !== "undefined") {
        updates.push({ key: "tags", value: tags });
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
        id: deckId,
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

    const paramsValidation = this.validate(
      z.object({ deckId: z.string().trim().uuid("Baralho inválido.") }),
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

    const { deckId } = paramsValidation.data;
    try {
      const deck = await this.ensureDeckBelongsToUser(deckId, user.id);
      if (!deck) {
        this.sendToastResponse(res, {
          status: 404,
          message: "Baralho não encontrado.",
          variant: "danger",
        });
        return;
      }

      await deckModel.delete({
        params: [
          { key: "id", value: deckId },
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

    const paramsValidation = this.validate(
      z.object({ deckId: z.string().trim().uuid("Baralho inválido.") }),
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

    const schema = z.object({
      question: z.string().trim().min(1, "Informe a pergunta."),
      answer: z.string().trim().min(1, "Informe a resposta."),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      tags: z.preprocess((value) => this.parseTags(value), z.array(z.string())),
      source: z.string().trim().optional(),
    });

    const validation = this.validate(schema, req.body ?? {});
    if (!validation.success) {
      this.sendToastResponse(res, {
        status: 400,
        message: validation.message,
        variant: "danger",
      });
      return;
    }

    const { deckId } = paramsValidation.data;
    const { question, answer, difficulty, tags, source } = validation.data;
    const normalizedDifficulty = difficulty ?? "medium";
    const normalizedSource = source && source.length > 0 ? source : "Manual";

    try {
      const deck = await this.ensureDeckBelongsToUser(deckId, user.id);
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
          { key: "question", value: question },
          { key: "answer", value: answer },
          { key: "user_id", value: user.id },
          { key: "deck_id", value: deckId },
          { key: "status", value: "new" },
          { key: "review_count", value: 0 },
          { key: "last_review_date", value: null },
          { key: "next_review_date", value: null },
          { key: "difficulty", value: normalizedDifficulty },
          { key: "tags", value: tags },
          { key: "source", value: normalizedSource },
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

    const paramsValidation = this.validate(
      z.object({
        deckId: z.string().trim().uuid("Baralho inválido."),
        cardId: z.string().trim().uuid("Carta inválida."),
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

    const schema = z.object({
      question: z.string().trim().min(1, "A pergunta não pode ficar vazia.").optional(),
      answer: z.string().trim().min(1, "A resposta não pode ficar vazia.").optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      tags: z
        .preprocess((value) => {
          if (typeof value === "undefined") {
            return undefined;
          }
          return this.parseTags(value);
        }, z.array(z.string()))
        .optional(),
    });

    const validation = this.validate(schema, req.body ?? {});
    if (!validation.success) {
      this.sendToastResponse(res, {
        status: 400,
        message: validation.message,
        variant: "danger",
      });
      return;
    }

    const { deckId, cardId } = paramsValidation.data;
    const { question, answer, difficulty, tags } = validation.data;

    try {
      const card = (await flashcardModel.findOne({
        params: [
          { key: "id", value: cardId },
          { key: "deck_id", value: deckId },
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
      if (typeof question !== "undefined") {
        updates.push({ key: "question", value: question });
      }

      if (typeof answer !== "undefined") {
        updates.push({ key: "answer", value: answer });
      }

      if (typeof difficulty !== "undefined") {
        updates.push({ key: "difficulty", value: difficulty });
      }

      if (typeof tags !== "undefined") {
        updates.push({ key: "tags", value: tags });
      }

      if (updates.length === 0) {
        this.sendToastResponse(res, {
          status: 200,
          message: "Nenhuma alteração foi aplicada nesta carta.",
          variant: "info",
        });
        return;
      }

      await flashcardModel.update({ id: cardId, fields: updates });

      this.sendToastResponse(res, {
        status: 200,
        message: "Carta atualizada com sucesso!",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to update card", error, res);
    }
  };

  private handleDeleteCard = async (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const paramsValidation = this.validate(
      z.object({
        deckId: z.string().trim().uuid("Baralho inválido."),
        cardId: z.string().trim().uuid("Carta inválida."),
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

    const { deckId, cardId } = paramsValidation.data;

    try {
      const card = await flashcardModel.findOne({
        params: [
          { key: "id", value: cardId },
          { key: "deck_id", value: deckId },
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
          { key: "id", value: cardId },
          { key: "deck_id", value: deckId },
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

    const paramsValidation = this.validate(
      z.object({ deckId: z.string().trim().uuid("Baralho inválido.") }),
      req.params,
    );
    if (!paramsValidation.success) {
      res
        .status(400)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send(`<div class="alert alert-danger" role="alert">${paramsValidation.message}</div>`);
      return;
    }

    const schema = z.object({
      content: z.string().trim().min(1, "Cole algum conteúdo para que possamos gerar sugestões."),
      createImmediately: z.preprocess((value) => this.parseCheckbox(value), z.boolean()),
      goal: z.string().trim().optional(),
    });

    const validation = this.validate(schema, req.body ?? {});
    if (!validation.success) {
      res
        .status(400)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send(`<div class="alert alert-danger" role="alert">${validation.message}</div>`);
      return;
    }

    const { deckId } = paramsValidation.data;
    const { content, createImmediately, goal } = validation.data;

    try {
      const deck = await this.ensureDeckBelongsToUser(deckId, user.id);
      if (!deck) {
        res
          .status(404)
          .setHeader("Content-Type", "text/html; charset=utf-8")
          .send('<div class="alert alert-danger" role="alert">Baralho não encontrado.</div>');
        return;
      }

      const sections = content
        .split(/\n+/)
        .map((section: string) => section.trim())
        .filter((section: string) => section.length > 0);

      const cards = sections.slice(0, 3).map((section: string) => ({
        question: `Qual é o conceito principal sobre "${section.slice(0, 60)}"?`,
        answer: section.length > 280 ? `${section.slice(0, 277)}...` : section,
      }));

      if (createImmediately && cards.length > 0) {
        for (const suggestion of cards) {
          await flashcardModel.insert({
            fields: [
              { key: "id", value: UuidGeneratorAdapter.generate() },
              { key: "question", value: suggestion.question },
              { key: "answer", value: suggestion.answer },
              { key: "user_id", value: user.id },
              { key: "deck_id", value: deckId },
              { key: "status", value: "new" },
              { key: "review_count", value: 0 },
              { key: "last_review_date", value: null },
              { key: "next_review_date", value: null },
              { key: "difficulty", value: "medium" },
              { key: "tags", value: [] },
              {
                key: "source",
                value: goal && goal.length > 0 ? `Objetivo: ${goal}` : "Sugestão da IA",
              },
            ],
          });
        }

        res
          .status(200)
          .setHeader("Content-Type", "text/html; charset=utf-8")
          .send(
            `<div class="alert alert-success" role="alert">${cards.length} flashcards foram adicionados diretamente ao baralho.</div>`,
          );
        return;
      }

      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(this.buildCardPreviewMarkup(cards));
    } catch (error) {
      console.error("Failed to generate AI suggestion", error);
      res
        .status(500)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send('<div class="alert alert-danger" role="alert">Não foi possível gerar sugestões no momento. Tente novamente mais tarde.</div>');
    }
  };
}
