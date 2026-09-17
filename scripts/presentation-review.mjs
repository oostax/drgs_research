// Bootstrap a reproducible review environment; replaced by regression checks below.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
mkdirSync('review-artifacts', { recursive: true });
execFileSync('tar', ['-czf', 'review-artifacts/review-runtime.tgz', 'node_modules', 'dist']);
console.log('Review runtime prepared from the locked production build.');
