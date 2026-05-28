# Luban Spike Decision

Task 1 uses hand-authored TypeScript fallback tables.

Luban is not adopted in this slice because the repo does not yet have a proven local Luban generation path, checked-in schema source, or repeatable build command that can run without touching downstream runtime systems. The P0 contract keeps each target-state system in its own config table and validates references from TypeScript until a later spike proves Luban generation locally.
