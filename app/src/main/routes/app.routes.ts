import { Request, Response, Router } from "express";

interface Deck {
  id: string;
  name: string;
  description: string;
  subject: string;
  dueToday: number;
  totalCards: number;
  mastered: number;
  newCards: number;
  reviewCards: number;
  color: string;
  lastStudied: string;
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  tags: string[];
  lastReviewed: string;
  ease: "Fácil" | "Médio" | "Difícil";
  status: string;
}

const appRouter = Router();

const mockUser = {
  name: "Mariana Andrade",
  email: "mariana.andrade@example.com",
  avatarUrl: "https://ui-avatars.com/api/?name=Mariana+Andrade",
  role: "Estudante ENEM",
};

const decks: Deck[] = [
  {
    id: "enem-bio",
    name: "Biologia ENEM",
    description: "Genética, ecologia e fisiologia humana.",
    subject: "Ciências da Natureza",
    dueToday: 12,
    totalCards: 180,
    mastered: 68,
    newCards: 5,
    reviewCards: 27,
    color: "success",
    lastStudied: "Há 2 horas",
  },
  {
    id: "enem-hist",
    name: "História do Brasil",
    description: "Brasil Colônia ao período republicano.",
    subject: "Ciências Humanas",
    dueToday: 4,
    totalCards: 140,
    mastered: 51,
    newCards: 3,
    reviewCards: 12,
    color: "primary",
    lastStudied: "Ontem",
  },
  {
    id: "enem-mat",
    name: "Matemática Avançada",
    description: "Geometria, estatística e funções.",
    subject: "Matemática",
    dueToday: 20,
    totalCards: 220,
    mastered: 74,
    newCards: 6,
    reviewCards: 32,
    color: "warning",
    lastStudied: "Há 3 dias",
  },
];

const flashcardsByDeck: Record<string, Flashcard[]> = {
  "enem-bio": [
    {
      id: "bio-1",
      front: "O que é mitose?",
      back: "Processo de divisão celular que resulta em duas células-filhas geneticamente idênticas à célula-mãe.",
      tags: ["Citologia"],
      lastReviewed: "Há 1 dia",
      ease: "Fácil",
      status: "Revisar hoje",
    },
    {
      id: "bio-2",
      front: "Defina genética mendeliana.",
      back: "Estudo dos mecanismos de herança baseados nas leis propostas por Gregor Mendel.",
      tags: ["Genética"],
      lastReviewed: "Há 4 dias",
      ease: "Médio",
      status: "Atenção",
    },
    {
      id: "bio-3",
      front: "O que é seleção natural?",
      back: "Processo evolutivo em que organismos mais adaptados ao ambiente tendem a sobreviver e reproduzir.",
      tags: ["Evolução"],
      lastReviewed: "Há 6 dias",
      ease: "Difícil",
      status: "Rever em breve",
    },
  ],
  "enem-hist": [
    {
      id: "hist-1",
      front: "Quando ocorreu a Independência do Brasil?",
      back: "Em 7 de setembro de 1822, com o grito do Ipiranga.",
      tags: ["Império"],
      lastReviewed: "Há 3 dias",
      ease: "Fácil",
      status: "Em dia",
    },
    {
      id: "hist-2",
      front: "O que foi a Era Vargas?",
      back: "Período de 1930 a 1945 marcado por forte centralização do poder e modernização industrial.",
      tags: ["República"],
      lastReviewed: "Há 1 semana",
      ease: "Médio",
      status: "Revisar semana",
    },
  ],
  "enem-mat": [
    {
      id: "mat-1",
      front: "Qual a fórmula da área de um círculo?",
      back: "A = π · r²",
      tags: ["Geometria"],
      lastReviewed: "Há 5 dias",
      ease: "Fácil",
      status: "Em dia",
    },
    {
      id: "mat-2",
      front: "O que é desvio padrão?",
      back: "Medida de dispersão que indica o quanto os valores se afastam da média.",
      tags: ["Estatística"],
      lastReviewed: "Há 2 dias",
      ease: "Médio",
      status: "Revisar hoje",
    },
    {
      id: "mat-3",
      front: "Defina função exponencial.",
      back: "Função em que a variável independente está no expoente, geralmente representada por f(x) = a · b^x.",
      tags: ["Funções"],
      lastReviewed: "Há 1 dia",
      ease: "Difícil",
      status: "Urgente",
    },
  ],
};

const aiGeneratedSuggestions = [
  {
    question: "Qual é a principal função das mitocôndrias?",
    answer:
      "As mitocôndrias são responsáveis pela produção de ATP por meio da respiração celular, fornecendo energia para a célula.",
  },
  {
    question: "Como o efeito estufa influencia o clima terrestre?",
    answer:
      "O efeito estufa mantém a temperatura da Terra adequada à vida ao reter parte do calor irradiado pela superfície, evitando variações extremas.",
  },
  {
    question: "Quais são os principais biomas brasileiros?",
    answer:
      "Amazônia, Cerrado, Mata Atlântica, Caatinga, Pantanal e Pampa, cada um com características climáticas e biodiversidade próprias.",
  },
];

const reviewSession = {
  deckId: "enem-bio",
  deckName: "Biologia ENEM",
  cards: [
    {
      id: "session-1",
      question: "Explique o que é osmose.",
      answer: "Passagem de solvente por uma membrana semipermeável de uma solução menos concentrada para outra mais concentrada.",
      hint: "Pense em equilíbrio entre soluções.",
      tags: ["Citologia", "Transporte celular"],
    },
    {
      id: "session-2",
      question: "Qual é a diferença entre DNA e RNA?",
      answer:
        "O DNA possui dupla hélice, açúcar desoxirribose e timina. O RNA é fita simples, tem ribose e uracila no lugar da timina.",
      hint: "Compare estrutura, açúcares e bases nitrogenadas.",
      tags: ["Genética"],
    },
    {
      id: "session-3",
      question: "O que é fotossíntese?",
      answer:
        "Processo em que organismos autotróficos convertem energia luminosa em energia química, produzindo glicose e oxigênio.",
      hint: "Lembre-se das duas etapas principais.",
      tags: ["Bioenergética"],
    },
  ],
  stats: {
    remaining: 18,
    dueToday: 12,
    newCards: 4,
    masteredPercentage: 0.52,
    streak: 6,
  },
};

const progressOverview = {
  streak: 8,
  totalDecks: decks.length,
  totalCards: decks.reduce((total, deck) => total + deck.totalCards, 0),
  masteredCards: decks.reduce((total, deck) => total + deck.mastered, 0),
  dueToday: decks.reduce((total, deck) => total + deck.dueToday, 0),
  reviewAccuracy: 0.84,
  aiGeneratedCards: 46,
  weeklyMinutes: 212,
  weeklyPerformance: [
    { label: "Seg", reviews: 45, minutes: 32 },
    { label: "Ter", reviews: 38, minutes: 28 },
    { label: "Qua", reviews: 52, minutes: 40 },
    { label: "Qui", reviews: 35, minutes: 30 },
    { label: "Sex", reviews: 41, minutes: 34 },
    { label: "Sáb", reviews: 28, minutes: 25 },
    { label: "Dom", reviews: 20, minutes: 23 },
  ],
  upcomingReviews: decks.map((deck) => ({
    deckId: deck.id,
    name: deck.name,
    due: deck.dueToday,
    nextSession: deck.lastStudied,
  })),
};

const accountPreferences = {
  timezone: "America/Sao_Paulo",
  weeklyGoal: 210,
  notifications: {
    dailyReminder: true,
    aiSuggestions: true,
    reviewSummary: false,
  },
  aiPreferences: {
    creativity: 0.6,
    depth: "Intermediário",
    tone: "Objetivo",
  },
};

function findDeckById(deckId: string): Deck | undefined {
  return decks.find((deck) => deck.id === deckId);
}

appRouter.get("/", (_req, res) => {
  res.redirect("/app/decks");
});

appRouter.get("/login", (_req, res) => {
  res.render("app/login", {
    pageTitle: "Entrar",
    showNavbar: false,
  });
});

appRouter.get("/sign-up", (_req, res) => {
  res.render("app/sign-up", {
    pageTitle: "Criar conta",
    showNavbar: false,
  });
});

appRouter.post("/login", (_req, res) => {
  res.json({
    error: false,
    message: "Login realizado com sucesso (mock).",
    redirect: "/app/decks",
  });
});

appRouter.post("/sign-up", (_req, res) => {
  res.json({
    error: false,
    message: "Conta criada! Bem-vindo à EducaIA (mock).",
    redirect: "/app/decks",
  });
});

appRouter.get("/decks", (req: Request, res: Response) => {
  const selectedDeck = req.query.deckId
    ? findDeckById(String(req.query.deckId))
    : decks[0];

  res.render("app/decks/index", {
    pageTitle: "Meus baralhos",
    user: mockUser,
    decks,
    selectedDeck,
    activePage: "decks",
  });
});

appRouter.get("/decks/:deckId/cards", (req, res) => {
  const { deckId } = req.params;
  const deck = findDeckById(deckId);

  res.render("app/decks/cards", {
    pageTitle: deck ? `${deck.name} · Cartões` : "Cartões",
    user: mockUser,
    deck,
    cards: flashcardsByDeck[deckId] ?? [],
    decks,
    activePage: "decks",
  });
});

appRouter.get("/import", (_req, res) => {
  res.render("app/import/index", {
    pageTitle: "Importar conhecimento",
    user: mockUser,
    decks,
    suggestions: aiGeneratedSuggestions,
    activePage: "import",
  });
});

appRouter.get("/import/examples", (_req, res) => {
  res.render("app/import/partials/suggestions", {
    suggestions: aiGeneratedSuggestions,
  });
});

appRouter.get("/learning", (_req, res) => {
  res.render("app/learning/index", {
    pageTitle: "Sessão de revisão",
    user: mockUser,
    session: reviewSession,
    activePage: "learning",
  });
});

appRouter.get("/progress", (_req, res) => {
  res.render("app/progress/index", {
    pageTitle: "Indicadores",
    user: mockUser,
    progress: progressOverview,
    decks,
    activePage: "progress",
  });
});

appRouter.get("/account", (_req, res) => {
  res.render("app/account/index", {
    pageTitle: "Minha conta",
    user: mockUser,
    preferences: accountPreferences,
    activePage: "account",
  });
});

appRouter.get("/decks/:deckId/preview", (req, res) => {
  const deck = findDeckById(req.params.deckId);

  res.render("app/decks/partials/preview", {
    deck,
  });
});

appRouter.get("/learning/next", (req, res) => {
  const index = Number(req.query.index ?? 0);
  const card = reviewSession.cards[index % reviewSession.cards.length];

  res.render("app/learning/partials/card", {
    card,
    index,
    session: reviewSession,
  });
});

appRouter.post("/decks", (_req, res) => {
  res.json({
    error: false,
    message: "Baralho criado com sucesso (mock).",
  });
});

appRouter.post("/decks/:deckId/cards", (req, res) => {
  const { deckId } = req.params;
  const deck = findDeckById(deckId);

  res.json({
    error: false,
    message: deck
      ? `Novo flashcard adicionado ao baralho ${deck.name} (mock).`
      : "Baralho não encontrado, mas a requisição foi recebida (mock).",
  });
});

appRouter.post("/import", (_req, res) => {
  res.json({
    error: false,
    message: "Solicitação enviada para a IA (mock).",
  });
});

appRouter.post("/learning/answer", (_req, res) => {
  res.json({
    error: false,
    message: "Resposta registrada. Continue praticando!",
  });
});

appRouter.post("/account", (_req, res) => {
  res.json({
    error: false,
    message: "Preferências atualizadas (mock).",
  });
});

appRouter.post("/simulate-error", (_req, res) => {
  res.json({
    error: true,
    message: "Exemplo de erro vindo da API (mock).",
  });
});

export { appRouter };
