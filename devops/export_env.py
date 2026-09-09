import os
import sys
import json
import shlex

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "env"  # "build_args" or "env"
    branch_prefix = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("BRANCH_PREFIX", "")
    output_file = sys.argv[3] if len(sys.argv) > 3 else ".env"

    if not branch_prefix:
        print("Error: branch_prefix is required", file=sys.stderr)
        sys.exit(1)

    all_vars = {}

    # 1. Process environment variables (including all declared branch secrets)
    for k, v in os.environ.items():
        if k.startswith(branch_prefix) and v:
            key = k[len(branch_prefix):]
            all_vars[key] = v

    # 2. Process ALLMYVARS if present
    vars_json = os.environ.get("ALLMYVARS", "")
    if vars_json:
        try:
            parsed_vars = json.loads(vars_json)
            for k, v in parsed_vars.items():
                if k.startswith(branch_prefix) and v:
                    key = k[len(branch_prefix):]
                    all_vars[key] = str(v)
        except Exception as e:
            print(f"Warning: Could not parse ALLMYVARS: {e}", file=sys.stderr)

    with open(output_file, "a" if mode == "build_args" else "w") as f:
        for k, v in sorted(all_vars.items()):
            if mode == "build_args":
                f.write(f"{k}={v}\n")
            else:
                if v.isdigit():
                    f.write(f"{k}={v}\n")
                else:
                    f.write(f"{k}={shlex.quote(v)}\n")

    print(f"Successfully exported {len(all_vars)} variables to {output_file}")

if __name__ == "__main__":
    main()
