# Copyright Sierra
"""Load wiki prompt content used by the agent."""

import os

FOLDER_PATH = os.path.dirname(__file__)

with open(os.path.join(FOLDER_PATH, "taubench.md")) as f:
    WIKI = f.read()
