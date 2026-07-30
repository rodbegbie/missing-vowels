import { rot13 } from "../App";

export function jsonResponse(body: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);
}

export function installFetchMock(responses: unknown[] = []): jest.Mock {
  const fetchMock = jest.fn();
  for (const response of responses) {
    fetchMock.mockImplementationOnce(() => jsonResponse(response));
  }
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

export function queueFetchResponse(
  fetchMock: jest.Mock,
  response: unknown,
): void {
  fetchMock.mockImplementationOnce(() => jsonResponse(response));
}

export const difficultiesResponse = {
  difficulties: [
    { level: 1, name: "Easy", count: 3 },
    { level: 5, name: "Hard", count: 1 },
  ],
};

export function mask(word: string): string {
  return word.toUpperCase().replace(/[AEIOU]/g, "");
}

export function makeRound(category: string, answers: string[]) {
  return {
    category,
    difficulty: 2,
    clues: answers.map((answer) => ({
      clue: mask(answer),
      answer: rot13(answer),
      vowels_removed: 1,
    })),
  };
}

interface MockResultEvent {
  resultIndex: number;
  results: { 0: { transcript: string } }[];
}

export class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];

  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: MockResultEvent) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  start = jest.fn();
  stop = jest.fn(() => {
    this.onend?.();
  });

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }

  emitResult(transcript: string): void {
    this.onresult?.({
      resultIndex: 0,
      results: [{ 0: { transcript } }],
    });
  }

  static reset(): void {
    MockSpeechRecognition.instances = [];
  }
}
