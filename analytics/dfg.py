#!/usr/bin/env python3
"""Discover two directly-follows graphs (DFG) from a Promptzilla event log:
frequency (how often B follows A) and performance (time between A and B).

Usage (through Docker, files are read from / written to analytics/out/):
  docker compose run --rm dfg [--input events.csv] [--activity coarse] [--lang en]
      [--game-lang es] [--aggregation median] [--format svg]

Options:
  --input        Event log produced by xapi_to_pm.py, .xes or .csv
                 (default: events.xes). Relative paths are inside analytics/out/.
  --activity     Label used as the name of each node:
                   fine    verb + object (e.g. "answered Heading tags"); many nodes.
                   coarse  verb + object type (e.g. "answered question");
                           readable overview.
                 Any other value is used as a column name (e.g. concept:name).
  --lang         Language of the node labels: es (default) or en. Games played
                 in any language are included unless --game-lang is given.
  --game-lang    Keep only games played in this language (es or en), e.g. to
                 compare how students behave in each one.
  --aggregation  Statistic of the elapsed time between two consecutive
                 activities shown on the performance DFG edges: mean (default),
                 median (robust to students who leave the game idle), min, max,
                 sum or stdev.
  --format       Image format of both graphs: png (default), svg (zoomable,
                 best for large graphs) or pdf.
  --out-dir      Where the images are written (default: current dir, i.e.
                 analytics/out/ in Docker).

Output: <input>_<activity>_<lang>[_game-<game-lang>]_dfg_frequency.<format> (edge
label = number of times B directly followed A) and the matching
..._dfg_performance.<format> (edge label = aggregated time between A and B).
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
    ap.add_argument("--activity", default="fine",
                    help="fine, coarse, or a column name (e.g. concept:name)")
    ap.add_argument("--lang", default="es", choices=["es", "en"], help="language of the node labels")
    ap.add_argument("--game-lang", choices=["es", "en"], help="keep only games played in this language")
    ap.add_argument("--aggregation", default="mean",
                    choices=["mean", "median", "min", "max", "sum", "stdev"],
                    help="time statistic shown on the performance DFG edges")
    ap.add_argument("--format", default="png", choices=["png", "svg", "pdf"])
    ap.add_argument("--out-dir", default=".")
    args = ap.parse_args()

    if not os.path.exists(args.input):
        sys.exit(f"Input not found: {args.input}")
    df = load_log(args.input)
    column = f"activity_{args.activity}_{args.lang}" if args.activity in ("fine", "coarse") else args.activity
    if column not in df.columns:
        sys.exit(f"Column {column!r} not in the log (re-export it with xapi_to_pm.py). "
                 f"Available: {', '.join(df.columns)}")
    if args.game_lang:
        if "lang" not in df.columns:
            sys.exit("The log has no 'lang' column (re-export it with xapi_to_pm.py).")
        df = df[df["lang"] == args.game_lang]
        if df.empty:
            sys.exit(f"No games played in {args.game_lang!r}.")

    keys = {"activity_key": column, "case_id_key": CASE, "timestamp_key": TIMESTAMP}
    stem = os.path.splitext(os.path.basename(args.input))[0]
    tag = f"{args.activity}_{args.lang}" if args.activity in ("fine", "coarse") else column.replace(":", "-")
    if args.game_lang:
        tag += f"_game-{args.game_lang}"
    os.makedirs(args.out_dir, exist_ok=True)
    freq_path = os.path.join(args.out_dir, f"{stem}_{tag}_dfg_frequency.{args.format}")
    perf_path = os.path.join(args.out_dir, f"{stem}_{tag}_dfg_performance.{args.format}")

    dfg, start, end = pm4py.discover_dfg(df, **keys)
    pm4py.save_vis_dfg(dfg, start, end, freq_path)

    perf_dfg, start, end = pm4py.discover_performance_dfg(df, **keys)
    pm4py.save_vis_performance_dfg(perf_dfg, start, end, perf_path, aggregation_measure=args.aggregation)

    print(f"{df[CASE].nunique()} cases, {len(df)} events, {len(dfg)} edges -> {freq_path}, {perf_path}")


if __name__ == "__main__":
    main()
