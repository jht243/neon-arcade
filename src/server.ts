import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type ListResourceTemplatesRequest,
  type ListResourcesRequest,
  type ListToolsRequest,
  type ReadResourceRequest,
  type Resource,
  type ResourceTemplate,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

type ArcadeWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  html: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_ROOT_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = (() => {
  const envRoot = process.env.ASSETS_ROOT;
  if (envRoot) {
    const candidate = path.resolve(envRoot);
    try {
      const candidateAssets = path.join(candidate, "assets");
      if (fs.existsSync(candidateAssets)) {
        return candidate;
      }
    } catch {
      // fall through
    }
  }
  return DEFAULT_ROOT_DIR;
})();

const ASSETS_DIR = path.resolve(ROOT_DIR, "assets");

function readWidgetHtml(componentName: string): string {
  if (!fs.existsSync(ASSETS_DIR)) {
    throw new Error(
      `Widget assets not found. Expected directory ${ASSETS_DIR}. Run "pnpm run build" before starting the server.`
    );
  }

  const directPath = path.join(ASSETS_DIR, `${componentName}.html`);
  let htmlContents: string | null = null;
  let loadedFrom = "";

  if (fs.existsSync(directPath)) {
    htmlContents = fs.readFileSync(directPath, "utf8");
    loadedFrom = directPath;
  } else {
    const candidates = fs
      .readdirSync(ASSETS_DIR)
      .filter(
        (file) => file.startsWith(`${componentName}-`) && file.endsWith(".html")
      )
      .sort();
    const fallback = candidates[candidates.length - 1];
    if (fallback) {
      const fallbackPath = path.join(ASSETS_DIR, fallback);
      htmlContents = fs.readFileSync(fallbackPath, "utf8");
      loadedFrom = fallbackPath;
    }
  }

  if (!htmlContents) {
    throw new Error(
      `Widget HTML for "${componentName}" not found in ${ASSETS_DIR}. Run "pnpm run build" to generate the assets.`
    );
  }

  console.log(`[Widget Load] File: ${loadedFrom}`);
  console.log(`[Widget Load] HTML length: ${htmlContents.length} bytes`);

  return htmlContents;
}

const VERSION =
  (process.env.RENDER_GIT_COMMIT?.slice(0, 7) || Date.now().toString()) +
  "-" +
  Date.now();

function widgetMeta(widget: ArcadeWidget, bustCache: boolean = false) {
  const templateUri = bustCache
    ? `ui://widget/neon-arcade.html?v=${VERSION}`
    : widget.templateUri;

  return {
    "openai/outputTemplate": templateUri,
    "openai/widgetDescription":
      "Neon Arcade — a retro-styled arcade with multiple games including Snake, Minesweeper, and more. Badges, skins, leaderboards, and combos.",
    "openai/componentDescriptions": {
      "homepage":
        "Game selection screen showing all available arcade games with retro pixel-art cards.",
      "game-board":
        "The main game canvas for whichever game the user is playing. Displays particle effects, screen flash, and visual feedback.",
      "score-panel":
        "Header panel showing game-specific stats like score, time, level, and point balance.",
      "controls-panel":
        "On-screen controls for mobile and touch users. Hidden on desktop where keyboard/mouse controls are used.",
      "tab-bar":
        "Bottom navigation with tabs for the leaderboard, badge collection, and skin shop.",
    },
    "openai/widgetKeywords": [
      "arcade",
      "snake",
      "minesweeper",
      "retro",
      "neon",
      "game",
      "play",
      "classic",
      "leaderboard",
      "badges",
      "skins",
      "combo",
      "pixel",
      "fun",
    ],
    "openai/sampleConversations": [
      {
        user: "I want to play a game",
        assistant:
          "Here's the Neon Arcade — pick a game and enjoy!",
      },
      {
        user: "I'm bored, what can I do?",
        assistant:
          "How about the Neon Arcade? You can play Snake, Minesweeper, and more!",
      },
      {
        user: "Play snake",
        assistant:
          "Here you go — enjoy Snake in the Neon Arcade!",
      },
      {
        user: "I want to play minesweeper",
        assistant:
          "Here's the Neon Arcade — jump into Minefield!",
      },
      {
        user: "Play a fun retro game",
        assistant:
          "Here's the Neon Arcade — have fun!",
      },
    ],
    "openai/starterPrompts": [
      "Play a game",
      "I'm bored, let me play something",
      "Play Snake",
      "Play Minesweeper",
    ],
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": {
      connect_domains: [] as string[],
      script_src_domains: [] as string[],
      resource_domains: [
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
      ],
    },
    "openai/widgetDomain": "https://web-sandbox.oaiusercontent.com",
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  } as const;
}

const widgets: ArcadeWidget[] = [
  {
    id: "play_neon_arcade",
    title: "Neon Arcade — retro arcade with Snake, Minesweeper & more",
    templateUri: `ui://widget/neon-arcade.html?v=${VERSION}`,
    invoking: "Loading Neon Arcade...",
    invoked: "Neon Arcade is ready — pick a game and play!",
    html: readWidgetHtml("neon-arcade"),
  },
];

const widgetsById = new Map<string, ArcadeWidget>();
const widgetsByUri = new Map<string, ArcadeWidget>();

widgets.forEach((widget) => {
  widgetsById.set(widget.id, widget);
  widgetsByUri.set(widget.templateUri, widget);
});

const VALID_GAMES = ["snake", "minesweeper", "brickbreaker", "mazerunner", "neondash"] as const;
type GameId = (typeof VALID_GAMES)[number];

const toolInputSchema = {
  type: "object",
  properties: {
    game: {
      type: "string",
      enum: ["snake", "minesweeper", "brickbreaker", "mazerunner", "neondash"],
      description:
        "Which game to open directly. Map the user's intent to one of the allowed values: " +
        "'snake' for Snake / snek / snke. " +
        "'minesweeper' for Minesweeper / Minefield / mines / mine sweeper / mine field. " +
        "'brickbreaker' for Brick Breaker / bricks / breakout / brick break. " +
        "'mazerunner' for Maze Runner / maze / labyrinth. " +
        "'neondash' for Neon Dash / neon / dash / runner / endless runner. " +
        "If the user just says 'play a game' or doesn't specify, omit this field.",
      examples: ["snake", "minesweeper", "brickbreaker", "mazerunner", "neondash"],
    },
  },
  required: [],
  additionalProperties: false,
  $schema: "http://json-schema.org/draft-07/schema#",
} as const;

const toolInputParser = z.object({
  game: z.enum(VALID_GAMES).optional(),
});

const toolOutputSchema = {
  type: "object",
  properties: {
    ready: { type: "boolean" },
    game: {
      type: ["string", "null"],
      enum: [...VALID_GAMES, null],
    },
  },
} as const;

const tools: Tool[] = widgets.map((widget) => ({
  name: widget.id,
  description:
    "Open the Neon Arcade — a retro arcade with Snake, Minesweeper, Brick Breaker, Maze Runner, and Neon Dash. " +
    "If the user asks for a specific game, pass the game parameter to open it directly. " +
    "If the user just wants to play or browse, omit the game parameter to show the homepage.",
  inputSchema: toolInputSchema,
  outputSchema: toolOutputSchema,
  title: widget.title,
  securitySchemes: [{ type: "noauth" }],
  _meta: {
    ...widgetMeta(widget),
    "openai/visibility": "public",
    securitySchemes: [{ type: "noauth" }],
  },
  annotations: {
    destructiveHint: false,
    openWorldHint: false,
    readOnlyHint: true,
  },
}));

const resources: Resource[] = widgets.map((widget) => ({
  uri: widget.templateUri,
  name: widget.title,
  description: "HTML template for the Neon Arcade widget.",
  mimeType: "text/html+skybridge",
  _meta: widgetMeta(widget),
}));

const resourceTemplates: ResourceTemplate[] = widgets.map((widget) => ({
  uriTemplate: widget.templateUri,
  name: widget.title,
  description: "Template descriptor for the Neon Arcade widget.",
  mimeType: "text/html+skybridge",
  _meta: widgetMeta(widget),
}));

function createArcadeServer(): Server {
  const server = new Server(
    {
      name: "neon-arcade",
      version: "0.2.0",
      description:
        "Neon Arcade — a retro-styled arcade with multiple games (Snake, Minesweeper, and more), playable as a ChatGPT widget.",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  server.setRequestHandler(
    ListResourcesRequestSchema,
    async (_request: ListResourcesRequest) => {
      console.log(
        `[MCP] resources/list called, returning ${resources.length} resources`
      );
      return { resources };
    }
  );

  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request: ReadResourceRequest) => {
      const widget = widgetsByUri.get(request.params.uri);

      if (!widget) {
        throw new Error(`Unknown resource: ${request.params.uri}`);
      }

      return {
        contents: [
          {
            uri: widget.templateUri,
            mimeType: "text/html+skybridge",
            text: widget.html,
            _meta: widgetMeta(widget),
          },
        ],
      };
    }
  );

  server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async (_request: ListResourceTemplatesRequest) => ({ resourceTemplates })
  );

  server.setRequestHandler(
    ListToolsRequestSchema,
    async (_request: ListToolsRequest) => ({ tools })
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      const startTime = Date.now();

      try {
        const widget = widgetsById.get(request.params.name);

        if (!widget) {
          console.error(`[MCP] Unknown tool: ${request.params.name}`);
          throw new Error(`Unknown tool: ${request.params.name}`);
        }

        let args: { game?: GameId };
        try {
          args = toolInputParser.parse(request.params.arguments ?? {});
        } catch (parseError: any) {
          console.error(`[MCP] Parse error: ${parseError.message}`);
          args = {};
        }

        const structured = {
          ready: true,
          game: args.game ?? null,
        };

        const responseTime = Date.now() - startTime;

        console.log(`[MCP] tool_call_success: ${request.params.name} game=${structured.game} (${responseTime}ms)`);

        const widgetMetadata = widgetMeta(widget, false);

        const metaForReturn = {
          ...widgetMetadata,
          "openai.com/widget": {
            type: "resource",
            resource: {
              uri: widget.templateUri,
              mimeType: "text/html+skybridge",
              text: widget.html,
              title: widget.title,
            },
          },
        } as const;

        return {
          content: [],
          structuredContent: structured,
          _meta: metaForReturn,
        };
      } catch (error: any) {
        console.error(`[MCP] tool_call_error: ${error.message}`);
        throw error;
      }
    }
  );

  return server;
}

type SessionRecord = {
  server: Server;
  transport: SSEServerTransport;
};

const sessions = new Map<string, SessionRecord>();

const ssePath = "/mcp";
const postPath = "/mcp/messages";
const healthPath = "/health";

const domainVerificationPath = "/.well-known/openai-apps-challenge";
const domainVerificationToken =
  process.env.OPENAI_DOMAIN_VERIFICATION_TOKEN ?? "placeholder-token";

async function handleSseRequest(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const server = createArcadeServer();
  const transport = new SSEServerTransport(postPath, res);
  const sessionId = transport.sessionId;

  sessions.set(sessionId, { server, transport });

  transport.onclose = async () => {
    sessions.delete(sessionId);
    await server.close();
  };

  transport.onerror = (error) => {
    console.error("SSE transport error", error);
  };

  try {
    await server.connect(transport);
  } catch (error) {
    sessions.delete(sessionId);
    console.error("Failed to start SSE session", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to establish SSE connection");
    }
  }
}

async function handlePostMessage(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    res.writeHead(400).end("Missing sessionId query parameter");
    return;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    res.writeHead(404).end("Unknown session");
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res);
  } catch (error) {
    console.error("Failed to process message", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to process message");
    }
  }
}

const portEnv = Number(process.env.PORT ?? 8000);
const port = Number.isFinite(portEnv) ? portEnv : 8000;

const httpServer = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) {
      res.writeHead(400).end("Missing URL");
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    if (
      req.method === "OPTIONS" &&
      (url.pathname === ssePath || url.pathname === postPath)
    ) {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === healthPath) {
      res.writeHead(200, { "Content-Type": "text/plain" }).end("OK");
      return;
    }

    if (req.method === "GET" && url.pathname === domainVerificationPath) {
      res
        .writeHead(200, { "Content-Type": "text/plain" })
        .end(domainVerificationToken);
      return;
    }

    if (req.method === "GET" && url.pathname === ssePath) {
      await handleSseRequest(res);
      return;
    }

    if (req.method === "POST" && url.pathname === postPath) {
      await handlePostMessage(req, res, url);
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
      const assetPath = path.join(ASSETS_DIR, url.pathname.slice(8));
      if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
        const ext = path.extname(assetPath).toLowerCase();
        const contentTypeMap: Record<string, string> = {
          ".js": "application/javascript",
          ".css": "text/css",
          ".html": "text/html",
          ".png": "image/png",
          ".svg": "image/svg+xml",
        };
        const contentType = contentTypeMap[ext] || "application/octet-stream";
        res.writeHead(200, {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        });
        fs.createReadStream(assetPath).pipe(res);
        return;
      }
    }

    res.writeHead(404).end("Not Found");
  }
);

httpServer.on("clientError", (err: Error, socket) => {
  console.error("HTTP client error", err);
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

httpServer.listen(port, () => {
  console.log(`Neon Arcade MCP server listening on http://localhost:${port}`);
  console.log(`  SSE stream:  GET http://localhost:${port}${ssePath}`);
  console.log(
    `  Message post: POST http://localhost:${port}${postPath}?sessionId=...`
  );
});
