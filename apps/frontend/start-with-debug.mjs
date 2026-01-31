#!/usr/bin/env node

// Just run the server directly without wrapper
// The wrapper was only monitoring parent process memory, not the actual server
import('./.output/server/index.mjs');
