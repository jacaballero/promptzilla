#!/usr/bin/env python3
"""Discover two directly-follows graphs (DFG) from a Promptzilla event log:
frequency (how often B follows A) and performance (time between A and B).

Usage (through Docker, files are read from / written to analytics/out/):
  docker compose run --rm dfg [--input events.csv] [--activity activity_coarse]
      [--aggregation median] [--format svg]

Options:
  --input        Event log produced by xapi_to_pm.py, .xes or .csv
                 (default: events.xes). Relative paths are inside analytics/out/.
  --activity     Column used as the activity name of each node:
                   concept:name     fine label, verb + object
                                    (e.g. "answered Reto 3"); many nodes.
                   activity_coarse  coarse label, verb + object type
                                    (e.g. "answered question"); readable overview.
  --aggregation  Statistic of the elapsed time between two consecutive
                 activities shown on the performance DFG edges: mean (default),
                 median (robust to students who leave the game idle), min, max,
                 sum or stdev.
  --format       Image format of both graphs: png (default), svg (zoomable,
                 best for large graphs) or pdf.
  --out-dir      Where the images are written (default: current dir, i.e.
                 analytics/out/ in Docker).

Output: <input name>_dfg_frequency.<format> (edge label = number of times
B directly followed A) and <input name>_dfg_performance.<format> (edge label =
aggregated time between A and B).
"""

import argparse
import os
import sys
import warnings

import pandas as pd
import pm4py

warnings.filterwarnings("ignore", message=r".*r4pm.*", category=UserWarning)

CASE = "case:concept:name"
TIMESTAMP = "time:timestamp"


def load_log(path):
    if path.lower().endswith(".csv"):
        df = pd.read_csv(path)
        df[TIMESTAMP] = pd.to_datetime(df[TIMESTAMP], utc=True, format="ISO8601")
    elif path.lower().endswith(".xes"):
        df = pm4py.read_xes(path)
    else:
        sys.exit(f"Unsupported input (use .xes or .csv): {path}")
    return df


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", default="events.xes", help="event log (.xes or .csv)")
    ap.add_argument("--activity", default="concept:name",
                    help="activity column: concept:name (fine) or activity_coarse (coarse)")
    ap.add_argument("--aggregation", default="mean",
                    choices=["mean", "median", "min", "max", "sum", "stdev"],
                    help="time statistic shown on the performance DFG edges")
    ap.add_argument("--format", default="png", choices=["png", "svg", "pdf"])
    ap.add_argument("--out-dir", default=".")
    args = ap.parse_args()

    if not os.path.exists(args.input):
        sys.exit(f"Input not found: {args.input}")
    df = load_log(args.input)
    if args.activity not in df.columns:
        sys.exit(f"Column {args.activity!r} not in the log. Available: {', '.join(df.columns)}")

    keys = {"activity_key": args.activity, "case_id_key": CASE, "timestamp_key": TIMESTAMP}
    stem = os.path.splitext(os.path.basename(args.input))[0]
    os.makedirs(args.out_dir, exist_ok=True)
    freq_path = os.path.join(args.out_dir, f"{stem}_dfg_frequency.{args.format}")
    perf_path = os.path.join(args.out_dir, f"{stem}_dfg_performance.{args.format}")

    dfg, start, end = pm4py.discover_dfg(df, **keys)
    pm4py.save_vis_dfg(dfg, start, end, freq_path)

    perf_dfg, start, end = pm4py.discover_performance_dfg(df, **keys)
    pm4py.save_vis_performance_dfg(perf_dfg, start, end, perf_path, aggregation_measure=args.aggregation)

    print(f"{df[CASE].nunique()} cases, {len(df)} events, {len(dfg)} edges -> {freq_path}, {perf_path}")


if __name__ == "__main__":
    main()
