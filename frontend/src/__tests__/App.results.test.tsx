import { act, fireEvent, render, screen } from "@testing-library/react";
import App from "../App";
import { difficultiesResponse, installFetchMock, makeRound } from "./testUtils";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// The countdown effect's setInterval is recreated every time `timeLeft`
// changes (it's a dependency), which only happens once React flushes the
// passive effect. Advancing the fake clock past 60s in one `act()` call lets
// the original interval free-run past zero before that flush occurs, so the
// "hit zero" transition is missed entirely. Ticking a second at a time gives
// React a chance to flush between ticks, matching real elapsed-time behavior.
function advanceToTimeUp(): void {
  for (let i = 0; i < 60; i++) {
    act(() => {
      jest.advanceTimersByTime(1000);
    });
  }
}

test("shows score, correct/missed/category counts, and per-category answers", async () => {
  const round = makeRound("UK Prime Ministers", [
    "CaseOne",
    "CaseTwo",
    "CaseThree",
  ]);
  installFetchMock([difficultiesResponse, round]);
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: /Easy/i }));
  await screen.findByText(round.clues[0].clue);

  fireEvent.click(screen.getByRole("button", { name: /Got It/i }));
  await screen.findByText("CaseOne");
  act(() => {
    jest.advanceTimersByTime(1500);
  });

  await screen.findByText(round.clues[1].clue);
  fireEvent.click(screen.getByRole("button", { name: /Show Answer/i }));
  await screen.findByText("CaseTwo");

  advanceToTimeUp();

  expect(await screen.findByText("Time's Up!")).toBeInTheDocument();
  expect(document.querySelector(".final-score")).toHaveTextContent("1");

  const stats = screen.getAllByText(/^\d+$/, { selector: ".result-value" });
  expect(stats.map((el) => el.textContent)).toEqual(["1", "1", "1"]);

  expect(screen.getByText("UK Prime Ministers")).toBeInTheDocument();
  expect(screen.getByText("CaseOne")).toBeInTheDocument();
  expect(screen.getByText("CaseTwo")).toBeInTheDocument();
});

test("Play Again resets to the menu", async () => {
  const round = makeRound("UK Prime Ministers", [
    "CaseOne",
    "CaseTwo",
    "CaseThree",
  ]);
  installFetchMock([difficultiesResponse, round]);
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: /Easy/i }));
  await screen.findByText(round.clues[0].clue);

  advanceToTimeUp();
  await screen.findByText("Time's Up!");

  fireEvent.click(screen.getByRole("button", { name: /Play Again/i }));

  expect(await screen.findByText("Select Difficulty")).toBeInTheDocument();
});
