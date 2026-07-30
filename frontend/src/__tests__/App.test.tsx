import { act, fireEvent, render, screen } from "@testing-library/react";
import App from "../App";
import {
  difficultiesResponse,
  installFetchMock,
  makeRound,
  queueFetchResponse,
} from "./testUtils";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function startGame(round: ReturnType<typeof makeRound>) {
  const fetchMock = installFetchMock([difficultiesResponse, round]);
  render(<App />);
  const button = await screen.findByRole("button", { name: /Easy/i });
  fireEvent.click(button);
  await screen.findByText(round.clues[0].clue);
  return fetchMock;
}

test("renders the difficulty menu from fetched difficulties", async () => {
  installFetchMock([difficultiesResponse]);
  render(<App />);
  expect(
    await screen.findByRole("button", { name: /Easy/i }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Hard/i })).toBeInTheDocument();
  expect(screen.getByText("3 categories")).toBeInTheDocument();
});

test("starts a game and shows the masked clue with the answer hidden", async () => {
  const round = makeRound("UK Prime Ministers", [
    "CaseOne",
    "CaseTwo",
    "CaseThree",
  ]);
  await startGame(round);
  expect(screen.getByText(round.clues[0].clue)).toBeInTheDocument();
  expect(screen.queryByText("CaseOne")).not.toBeInTheDocument();
});

test("reveals the answer and increments the score on Got It", async () => {
  const round = makeRound("UK Prime Ministers", [
    "CaseOne",
    "CaseTwo",
    "CaseThree",
  ]);
  await startGame(round);

  fireEvent.click(screen.getByRole("button", { name: /Got It/i }));

  expect(await screen.findByText("CaseOne")).toBeInTheDocument();
  expect(document.querySelector(".top-score")).toHaveTextContent("1");
});

test("advances to the next clue after the reveal delay", async () => {
  const round = makeRound("UK Prime Ministers", [
    "CaseOne",
    "CaseTwo",
    "CaseThree",
  ]);
  await startGame(round);

  fireEvent.click(screen.getByRole("button", { name: /Got It/i }));
  await screen.findByText("CaseOne");

  act(() => {
    jest.advanceTimersByTime(1500);
  });

  expect(await screen.findByText(round.clues[1].clue)).toBeInTheDocument();
});

test("loads the next category once every clue in the current one is revealed", async () => {
  const round = makeRound("UK Prime Ministers", [
    "CaseOne",
    "CaseTwo",
    "CaseThree",
  ]);
  const fetchMock = await startGame(round);

  // Reveal clue 1 of 3, advance past it.
  fireEvent.click(screen.getByRole("button", { name: /Got It/i }));
  await screen.findByText("CaseOne");
  act(() => {
    jest.advanceTimersByTime(1500);
  });
  await screen.findByText(round.clues[1].clue);

  // Reveal clue 2 of 3, advance past it.
  fireEvent.click(screen.getByRole("button", { name: /Got It/i }));
  await screen.findByText("CaseTwo");
  act(() => {
    jest.advanceTimersByTime(1500);
  });
  await screen.findByText(round.clues[2].clue);

  // Queue the next category before revealing the final clue.
  const nextRound = makeRound("Tube Lines", ["Jubilee", "Circle", "Central"]);
  queueFetchResponse(fetchMock, nextRound);

  // Reveal the final (3rd) clue — the following advance should fetch the next category.
  fireEvent.click(screen.getByRole("button", { name: /Got It/i }));
  await screen.findByText("CaseThree");
  act(() => {
    jest.advanceTimersByTime(1500);
  });

  expect(await screen.findByText("Tube Lines")).toBeInTheDocument();
  expect(await screen.findByText(nextRound.clues[0].clue)).toBeInTheDocument();
});

test("counts down the timer every second while playing", async () => {
  const round = makeRound("UK Prime Ministers", [
    "CaseOne",
    "CaseTwo",
    "CaseThree",
  ]);
  await startGame(round);

  expect(screen.getByText("60")).toBeInTheDocument();
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(screen.getByText("59")).toBeInTheDocument();
});

test("ends the round and shows results when the timer reaches zero", async () => {
  const round = makeRound("UK Prime Ministers", [
    "CaseOne",
    "CaseTwo",
    "CaseThree",
  ]);
  await startGame(round);

  act(() => {
    jest.advanceTimersByTime(60000);
  });

  expect(await screen.findByText("Time's Up!")).toBeInTheDocument();
});
