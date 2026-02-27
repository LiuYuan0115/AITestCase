import { Router, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export const cacheRouter = Router();

// 缓存文件目录
const CACHE_DIR = path.resolve(process.env.MIDSCENE_CACHE_DIR || './midscene_run/cache');

/**
 * GET /cache/list — 列出所有缓存文件及其统计
 * 返回每个缓存文件的 ID、大小、plan/locate 条目数、最后修改时间
 */
cacheRouter.get('/cache/list', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      res.json({ caches: [], totalSize: 0, cacheDir: CACHE_DIR });
      return;
    }
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.cache.yaml'));
    const caches = files.map(f => {
      const filePath = path.join(CACHE_DIR, f);
      const stat = fs.statSync(filePath);
      let planCount = 0;
      let locateCount = 0;
      try {
        const content = yaml.load(fs.readFileSync(filePath, 'utf-8')) as any;
        const entries = content?.caches || [];
        planCount = entries.filter((e: any) => e.type === 'plan').length;
        locateCount = entries.filter((e: any) => e.type === 'locate').length;
      } catch {
        // YAML 解析失败则忽略计数
      }
      return {
        id: f.replace('.cache.yaml', ''),
        fileName: f,
        sizeBytes: stat.size,
        lastModified: stat.mtime.toISOString(),
        planCount,
        locateCount,
      };
    });
    const totalSize = caches.reduce((sum, c) => sum + c.sizeBytes, 0);
    res.json({ caches, totalSize, cacheDir: CACHE_DIR });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /cache/:id — 删除指定用例的缓存
 */
cacheRouter.delete('/cache/:id', (req: Request, res: Response) => {
  const cacheId = req.params.id;
  const filePath = path.join(CACHE_DIR, `${cacheId}.cache.yaml`);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[cache] 已删除缓存: ${cacheId}`);
      res.json({ success: true, message: `缓存 ${cacheId} 已删除` });
    } else {
      res.status(404).json({ error: `缓存 ${cacheId} 不存在` });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /cache — 清空所有缓存
 */
cacheRouter.delete('/cache', (_req: Request, res: Response) => {
  try {
    if (fs.existsSync(CACHE_DIR)) {
      const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.cache.yaml'));
      files.forEach(f => fs.unlinkSync(path.join(CACHE_DIR, f)));
      console.log(`[cache] 已清空全部缓存，共 ${files.length} 个文件`);
      res.json({ success: true, deleted: files.length });
    } else {
      res.json({ success: true, deleted: 0 });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /cache/:id/detail — 查看指定缓存的详细内容
 */
cacheRouter.get('/cache/:id/detail', (req: Request, res: Response) => {
  const cacheId = req.params.id;
  const filePath = path.join(CACHE_DIR, `${cacheId}.cache.yaml`);
  try {
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: `缓存 ${cacheId} 不存在` });
      return;
    }
    const content = yaml.load(fs.readFileSync(filePath, 'utf-8'));
    res.json({ cacheId, content });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
