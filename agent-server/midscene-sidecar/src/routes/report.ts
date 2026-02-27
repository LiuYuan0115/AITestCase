import { Router } from 'express';
import express from 'express';
import path from 'path';
import fs from 'fs';

export const reportRouter = Router();

// ★ Midscene SDK 默认输出目录是 midscene_run（下划线），不是 midscene-run（短横线）
const REPORT_DIR = process.env.MIDSCENE_REPORT_DIR || './midscene_run/report';

// 静态文件服务：Midscene 报告内嵌 base64 截图，但也引用报告目录中的文件
const midsceneRunDir = path.resolve('./midscene_run');
reportRouter.use('/midscene_run', express.static(midsceneRunDir));
// 兼容旧路径（短横线）
reportRouter.use('/midscene-run', express.static(midsceneRunDir));

/**
 * GET /reports — List all available report files
 */
reportRouter.get('/reports', (_req, res) => {
  try {
    const absDir = path.resolve(REPORT_DIR);
    if (!fs.existsSync(absDir)) {
      res.json({ reports: [] });
      return;
    }

    const files = fs.readdirSync(absDir)
      .filter((f) => f.endsWith('.html'))
      .map((f) => {
        const stat = fs.statSync(path.join(absDir, f));
        return {
          name: f,
          path: path.join(absDir, f),
          size: stat.size,
          createdAt: stat.birthtime.toISOString(),
          modifiedAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

    res.json({ reports: files, dir: absDir });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /report/:filename — Serve a specific report HTML file
 */
reportRouter.get('/report/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.resolve(REPORT_DIR, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: `Report not found: ${filename}` });
    return;
  }

  res.sendFile(filePath);
});
