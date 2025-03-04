import chalk from 'chalk';
import log from '../log/logger.js';
import { cli } from "../parameters/cli.js";
import env from '../parameters/env.js';
import DataDir from "./datadir.js";

const cachedFns = cli.get('--cached-fns')?.split(',') || [];

export function fnOrCache<T>(filename: string, fn: () => T): T {
  const skipCacheFully = (env.isProduction || env.isTest);

  const file = DataDir.cache.file<T>(filename);

  const useCache = (
    !skipCacheFully &&
    cachedFns.includes(filename) &&
    file.exists()
  );

  if (useCache) {
    log.warn('Dev', chalk.bold.red(`CACHED FUNCTION MODE ENABLED FOR:`));
    log.warn('Dev', fn.toString());
    log.warn('Dev', chalk.bold.red(`FUNCTION SKIPPED; RETURNING CACHED VALUE`));
    return file.readJson();
  }
  else {
    const data = fn();
    if (!skipCacheFully) {
      file.writeJson(data);
    }
    return data;
  }
}
