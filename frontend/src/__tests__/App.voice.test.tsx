import { act, fireEvent, render, screen } from "@testing-library/react";
import App from "../App";
import {
  difficultiesResponse,
  installFetchMock,
  MockSpeechRecognition,
  makeRound,
} from "./testUtils";

beforeEach(() => {
  jest.useFakeTimers();
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
    MockSpeechRecognition;
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  MockSpeechRecognition.reset();
  delete (window as unknown as { SpeechRecognition?: unknown })
    .SpeechRecognition;
});

// See App.results.test.tsx's advanceToTimeUp for why a single large
// advanceTimersByTime(60000) can miss the "hit zero" transition when an
// earlier setTimeout (e.g. the voice startListening timer) has interleaved
// with the round timer's setInterval beforehand.
function advanceToTimeUp(): void {
  for (let i = 0; i < 60; i++) {
    act(() => {
      jest.advanceTimersByTime(1000);
    });
  }
}

async function startGameWithVoiceEnabled() {
  const round = makeRound("UK Prime Ministers", [
    "CaseOne",
    "CaseTwo",
    "CaseThree",
  ]);
  installFetchMock([difficultiesResponse, round]);
  render(<App />);

  const checkbox = await screen.findByRole("checkbox", {
    name: /Voice Recognition/i,
  });
  fireEvent.click(checkbox);

  fireEvent.click(await screen.findByRole("button", { name: /Easy/i }));
  await screen.findByText(round.clues[0].clue);

  return round;
}

test("a matching spoken transcript reveals the answer as correct", async () => {
  await startGameWithVoiceEnabled();
  act(() => {
    jest.advanceTimersByTime(300);
  });

  const recognition = MockSpeechRecognition.instances[0];
  act(() => {
    recognition.emitResult("case one");
  });

  expect(await screen.findByText("CaseOne")).toBeInTheDocument();
  expect(document.querySelector(".top-score")).toHaveTextContent("1");
});

test('saying "pass" reveals the current answer as incorrect', async () => {
  await startGameWithVoiceEnabled();
  act(() => {
    jest.advanceTimersByTime(300);
  });

  const recognition = MockSpeechRecognition.instances[0];
  act(() => {
    recognition.emitResult("pass");
  });

  expect(await screen.findByText("CaseOne")).toBeInTheDocument();
  expect(document.querySelector(".top-score")).toHaveTextContent("0");
});

test("saying a new game command on the results screen returns to the menu", async () => {
  await startGameWithVoiceEnabled();
  act(() => {
    jest.advanceTimersByTime(300);
  });

  advanceToTimeUp();
  await screen.findByText("Time's Up!");

  act(() => {
    jest.advanceTimersByTime(500);
  });

  const recognition = MockSpeechRecognition.instances[0];
  act(() => {
    recognition.emitResult("let's start a new game");
  });

  expect(await screen.findByText("Select Difficulty")).toBeInTheDocument();
});
