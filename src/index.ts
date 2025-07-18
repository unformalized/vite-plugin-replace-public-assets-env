import { copyFile, mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { loadEnv } from 'vite';
import type { Plugin, ResolvedConfig, UserConfig } from 'vite';

interface Options {
  /**
   * 默认值: ['.js', '.mjs']
   * 需要处理的文件后缀
   */
  exts?: string[];
}

/**
 * 递归复制文件夹中的所有内容到目标目录
 * @param sourceDir 源目录路径
 * @param targetDir 目标目录路径
 * @param afterCopy 拷贝完成后的回调函数
 */
async function copyAssets(
  sourceDir: string,
  targetDir: string,
  afterCopy: (filepath: string) => Promise<void>,
): Promise<void> {
  try {
    // 确保目标目录存在
    await mkdir(targetDir, { recursive: true });

    // 读取源目录下的所有文件/子目录
    const entries = await readdir(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = join(sourceDir, entry.name);
      const targetPath = join(targetDir, entry.name);

      if (entry.isDirectory()) {
        // 如果是目录，递归复制
        await copyAssets(sourcePath, targetPath, afterCopy);
      } else {
        // 如果是文件，复制文件
        await copyFile(sourcePath, targetPath);
        await afterCopy(targetPath);
      }
    }
  } catch (error) {
    console.log('[plugin vite-plugin-replace-public-assets-env] error: copy file or directory', error);
  }
}

export const vitePublicAssetsEnvReplacePlugin = (options?: Options): Plugin => {
  const { exts = ['.js', '.mjs'] } = options || {};
  let userConfig: UserConfig;
  let resolvedConfig: ResolvedConfig;
  const ENV_REGEX = /import\.meta\.env\.([A-Z_]+)/g;
  let env: Record<string, string> = {};
  const devPublicDir = '.public-assets';
  let userPublicDir = 'public';

  const rewriteContent = async (filePath: string) => {
    try {
      if (exts.some((ext) => filePath.endsWith(ext))) {
        const content = await readFile(filePath, 'utf-8');
        const replacedContent = content.replace(ENV_REGEX, (match, key) => {
          if (key in env) {
            return JSON.stringify(env[key]);
          } else {
            return match;
          }
        });
        await writeFile(filePath, replacedContent);
      }
    } catch (error) {
      console.log('[plugin vite-plugin-replace-public-assets-env] rewrite env content error', error);
    }
  };

  return {
    name: 'vite-public-assets-env-replace',
    config: async (config: UserConfig) => {
      userConfig = config;
      if (!userConfig.mode || !userConfig.envDir) return;
      userPublicDir = userConfig.publicDir || 'public';
      env = loadEnv(userConfig.mode, userConfig.envDir, userConfig.envPrefix);
      if (process.env.NODE_ENV === 'development') {
        const tempPublicDir = join('node_modules', devPublicDir);
        const sourceDir = join(userConfig.root || process.cwd(), userConfig.publicDir || 'public');
        const targetDir = join(userConfig.root || process.cwd(), tempPublicDir);
        await copyAssets(sourceDir, targetDir, async (filePath) => {
          await rewriteContent(filePath);
        });
        config.publicDir = tempPublicDir;
      }
    },
    async configResolved(config: ResolvedConfig) {
      resolvedConfig = config;
    },
    async closeBundle() {
      try {
        const publicDir = join(userConfig.root || process.cwd(), userPublicDir || 'public');
        const publicFiles = await readdir(publicDir);
        const distDir = resolve(userConfig.root || process.cwd(), resolvedConfig.build.outDir);
        const distFiles = await readdir(distDir);
        await Promise.all(
          distFiles
            .filter((item) => publicFiles.includes(item))
            .map(async (file) => {
              const filePath = join(distDir, file);
              return rewriteContent(filePath);
            }),
        );
      } catch (error) {
        console.log('[plugin vite-plugin-replace-public-assets-env] rewrite dist files error: ', error);
      }
    },
  };
};
