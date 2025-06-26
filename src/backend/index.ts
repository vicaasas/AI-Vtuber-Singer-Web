import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors'; // ✅ 新增這行

const app = express();
const port = 5000;
var modelUrl;

app.use(express.json());
app.use(cors()); // ✅ 允許所有來源跨域呼叫

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from backend!' });
});

// ✅ 用來轉 JSON 模型，並 patch 路徑加上 file/
app.get('/proxy/live2d', async (req, res) => {
  const targetUrl = req.query.url as string;
  modelUrl = getParentUrl(targetUrl);

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return void res.status(400).send('Invalid or missing URL.');
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (!response.ok) {
      res.status(response.status).send(await response.text());
      return;
    }
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const json = await response.json() as any;

      // ✅ 自動幫 moc, textures 等資源加上 "file/"
      const patchPath = (p: string) => `file/${p}`;
      const fr = json.FileReferences;

      if (fr?.Moc) fr.Moc = patchPath(fr.Moc);
      if (Array.isArray(fr?.Textures)) {
        fr.Textures = fr.Textures.map(patchPath);
      }
      if (fr?.Physics) fr.Physics = patchPath(fr.Physics);
      if (fr?.DisplayInfo) fr.DisplayInfo = patchPath(fr.DisplayInfo);
      if (Array.isArray(fr?.Expressions)) {
        fr.Expressions.forEach(exp => {
          if (exp.File) exp.File = patchPath(exp.File);
        });
      }
      if (fr?.Motions) {
        for (const group in fr.Motions) {
          fr.Motions[group].forEach(m => {
            if (m.File) m.File = patchPath(m.File);
          });
        }
      }

      return void res.json(json);
    }

    // fallback binary/json pass-through
    res.set('Content-Type', contentType || 'application/octet-stream');
    response.body?.pipe(res);

  } catch (err) {
    console.error('[Proxy Error]', err);
    res.status(500).send('Proxy error');
  }
});

// ✅ 提供 Live2D 模型子資源：貼圖、moc3、motion、physics 等
app.get('/proxy/file/{*splat}', async (req, res) => {
  const filepath = req.params["splat"].join('/');

  const targetUrl = `${modelUrl}${filepath}`; // 修改為你的 ngrok 或來源 base path

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'ngrok-skip-browser-warning': '69420',
      },
    });

    if (!response.ok) {
      res.status(response.status).send(await response.text());
      return;
    }

    res.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    response.body?.pipe(res);
  } catch (err) {
    console.error('[Proxy Error]', err);
    res.status(500).send('Proxy error');
  }
});

app.listen(port, () => {
  console.log(`✅ API server running at http://localhost:${port}`);
});


const getParentUrl = (urlStr) => {
    const url = new URL(urlStr);

    // 取得 pathname 並拆成 segments
    const segments = url.pathname.split('/');

    // 移除最後一個非空 segment
    while (segments.length > 0 && segments[segments.length - 1] === '') {
        segments.pop(); // 移除尾端空白 (處理結尾斜線)
    }

    if (segments.length > 1) {
        segments.pop(); // 移除最後一層
    }

    // 重建 pathname
    const newPath = segments.join('/') + '/';

    // 回傳組合的新 URL
    return `${url.origin}${newPath}`;
}