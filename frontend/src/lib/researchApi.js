import { apiGet, apiPost } from "./api";

export function fetchDatasets() {
  return apiGet("/datasets");
}

export function fetchBacktests(limit = 100) {
  return apiGet(`/backtests?limit=${limit}`);
}

export function fetchBacktest(backtestId) {
  return apiGet(`/backtests/${backtestId}`);
}

export function fetchDashboardOverview() {
  return apiGet("/dashboard/overview");
}

export function runStrategyEvaluation(payload) {
  return apiPost("/run-strategy", payload);
}

export function evaluateReplay(payload) {
  return apiPost("/replay/evaluate", payload);
}
