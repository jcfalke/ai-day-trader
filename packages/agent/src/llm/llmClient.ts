// ============================================================
// LLM Client — Anthropic Claude (OpenAI-compatible also supported)
// ============================================================
import axios from "axios";
import { TickerContext, LlmResponse } from "@ai-trader/shared";
import { LLM_CONFIG } from "@ai-trader/shared";
import { SYSTEM_PROMPT, buildUserPrompt, parseLlmResponse } from "./promptBuilder";
import { logger } from "../utils/logger";

interface LlmClientConfig {
  provider: "anthropic" | "openai";
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export class LlmClient {
  private config: LlmClientConfig;

  constructor(config: LlmClientConfig) {
    this.config = {
      model: LLM_CONFIG.MODEL_ID,
      ...config,
    };
  }

  async analyze(contexts: TickerContext[]): Promise<LlmResponse> {
    const symbols = contexts.map((c) => c.symbol);
    const userPrompt = buildUserPrompt(contexts);

    logger.info(`[LLM] Calling ${this.config.provider} for ${symbols.join(", ")}`);

    let rawText: string;
    let usage: { promptTokens: number; completionTokens: number } | undefined;

    if (this.config.provider === "anthropic") {
      ({ rawText, usage } = await this.callAnthropic(userPrompt));
    } else {
      ({ rawText, usage } = await this.callOpenAI(userPrompt));
    }

    logger.debug(`[LLM] Raw response:\n${rawText}`);
    const response = parseLlmResponse(rawText, symbols);
    response.model = this.config.model;
    response.usage = usage;
    return response;
  }

  // ----------------------------------------------------------
  // Anthropic Messages API
  // ----------------------------------------------------------
  private async callAnthropic(
    userPrompt: string
  ): Promise<{ rawText: string; usage: { promptTokens: number; completionTokens: number } }> {
    const url =
      this.config.baseUrl ?? "https://api.anthropic.com/v1/messages";
    const response = await axios.post(
      url,
      {
        model: this.config.model ?? LLM_CONFIG.MODEL_ID,
        max_tokens: LLM_CONFIG.MAX_TOKENS,
        temperature: LLM_CONFIG.TEMPERATURE,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      },
      {
        headers: {
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        timeout: 30000,
      }
    );

    const rawText: string =
      response.data?.content?.[0]?.text ?? "";
    const usage = {
      promptTokens: response.data?.usage?.input_tokens ?? 0,
      completionTokens: response.data?.usage?.output_tokens ?? 0,
    };
    return { rawText, usage };
  }

  // ----------------------------------------------------------
  // OpenAI Chat Completions API (also compatible with local LLMs)
  // ----------------------------------------------------------
  private async callOpenAI(
    userPrompt: string
  ): Promise<{ rawText: string; usage: { promptTokens: number; completionTokens: number } }> {
    const url =
      this.config.baseUrl ?? "https://api.openai.com/v1/chat/completions";
    const response = await axios.post(
      url,
      {
        model: this.config.model ?? "gpt-4o",
        max_tokens: LLM_CONFIG.MAX_TOKENS,
        temperature: LLM_CONFIG.TEMPERATURE,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "content-type": "application/json",
        },
        timeout: 30000,
      }
    );

    const rawText: string =
      response.data?.choices?.[0]?.message?.content ?? "";
    const usage = {
      promptTokens: response.data?.usage?.prompt_tokens ?? 0,
      completionTokens: response.data?.usage?.completion_tokens ?? 0,
    };
    return { rawText, usage };
  }
}
