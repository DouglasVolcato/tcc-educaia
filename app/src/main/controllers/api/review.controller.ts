import { Application, Request, Response } from "express";
import { BaseController } from "../base.controller.ts";
import { flashcardModel, FlashcardRow } from "../../../db/models/flashcard.model.ts";
import { z } from "zod";

const gradeSchema = z.object({
  cardId: z.string().uuid("Informe a carta que deseja avaliar."),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

export class ReviewController extends BaseController {
  constructor(app: Application) {
    super(app);
  }

  protected registerRoutes(): void {
    this.router.post("/review/grade", this.handleGradeCard);
    this.router.get("/review/hint", this.handleHint);
    this.router.get("/insights", this.handleInsights);
  }

  private handleGradeCard = async (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const payload = this.validate(
      gradeSchema.transform((values) => ({
        cardId: values.cardId,
        difficulty: this.normalizeDifficulty(values.difficulty),
      })),
      req.body ?? {},
      res,
    );

    if (!payload) {
      return;
    }

    try {
      const card = (await flashcardModel.findOne({
        params: [
          { key: "id", value: payload.cardId },
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

      const nextReview = this.computeNextReviewDate(
        payload.difficulty,
        card.review_count ?? 0,
      );

      await flashcardModel.update({
        id: payload.cardId,
        fields: [
          { key: "difficulty", value: payload.difficulty },
          { key: "status", value: payload.difficulty === "easy" ? "mastered" : "learning" },
          { key: "review_count", value: (card.review_count ?? 0) + 1 },
          { key: "last_review_date", value: new Date() },
          { key: "next_review_date", value: nextReview },
        ],
      });

      // Force the review page to refresh so the next card is displayed immediately
      res.setHeader("HX-Refresh", "true");

      this.sendToastResponse(res, {
        status: 200,
        message: "Progresso registrado! Continue avançando.",
        variant: "success",
      });
    } catch (error) {
      this.handleUnexpectedError("Failed to grade card", error, res);
    }
  };

  private handleHint = (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const hints = [
      "Explique a carta com suas próprias palavras para consolidar o aprendizado.",
      "Relacione o conteúdo com experiências pessoais para criar memórias duradouras.",
      "Intercale cartas fáceis e difíceis para evitar fadiga cognitiva.",
    ];
    const hint = hints[Math.floor(Math.random() * hints.length)];

    this.sendToastResponse(res, {
      status: 200,
      message: hint,
      variant: "info",
    });
  };

  private handleInsights = (req: Request, res: Response) => {
    const user = this.ensureAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const insights = [
      "Dedique os próximos 15 minutos aos baralhos com mais cartas pendentes para destravar progresso imediato.",
      "Experimente revisar cartas antigas antes de criar novas para reforçar a retenção.",
      "Suas revisões matinais têm melhor desempenho: planeje sessões curtas logo ao acordar.",
    ];

    const insight = insights[Math.floor(Math.random() * insights.length)];

    this.sendToastResponse(res, {
      status: 200,
      message: insight,
      variant: "info",
    });
  };
}
