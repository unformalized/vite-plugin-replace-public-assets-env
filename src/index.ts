import { readdir, readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { loadEnv, Plugin, ResolvedConfig, UserConfig } from 'vite';

interface Options {
  /**
   * 默认值: ['.js', '.mjs']
   * 需要处理的文件后缀
   */
  exts?: string[];
}

export const vitePublicAssetsEnvReplacePlugin = (options?: Options): Plugin => {
  const { exts = ['.js', '.mjs'] } = options || {};
  let config: UserConfig;
  let resolvedConfig: ResolvedConfig;
  const ENV_REGEX = /import\.meta\.env\.([A-Z_]+)/g;
  let env: Record<string, string> = {};
  let publicAssets: string[] = [];

  return {
    name: 'vite-public-assets-env-replace',
    config: (userConfig: UserConfig) => {
      config = userConfig;
    },
    configResolved(config: ResolvedConfig) {
      resolvedConfig = config;
    },
    async buildStart() {
      const _publicDir = resolve(config.root || process.cwd(), config.publicDir || 'public');
      if (!config || !config.mode || !config.envDir) return;
      env = loadEnv(config.mode, config.envDir, config.envPrefix);

      try {
        const files = await readdir(_publicDir);
        for (const file of files) {
          if (exts.some((ext) => file.endsWith(ext))) {
            publicAssets.push(file);
          }
        }
      } catch (error) {
        console.log('获取 public 下的文件列表失败');
      }
    },
    async closeBundle() {
      const _distDir = resolve(config.root || process.cwd(), resolvedConfig.build.outDir);
      try {
        const files = await readdir(_distDir);
        await Promise.all(
          files
            .filter((item) => publicAssets.includes(item))
            .map(async (file) => {
              const filePath = resolve(_distDir, file);
              const content = await readFile(filePath, 'utf-8');
              const replacedContent = content.replace(ENV_REGEX, (match, key) => {
                if (key in env) {
                  return JSON.stringify(env[key]);
                } else {
                  return match;
                }
              });
              await writeFile(filePath, replacedContent);
            }),
        );
      } catch (error) {
        console.log('获取并更改 dist 下的 public 文件失败');
      }
    },
  };
};
