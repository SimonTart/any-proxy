const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json());

function replaceRssLinksInContent(xmlContent, proxyHost) {
  let modifiedContent = xmlContent;
  
  // 替换 <link> 标签中的内容
  modifiedContent = modifiedContent.replace(/<link[^>]*>([^<]+)<\/link>/gi, (match, url) => {
    const trimmedUrl = url.trim();
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      const encodedUrl = encodeURIComponent(trimmedUrl);
      const proxyUrl = `${proxyHost}/proxy?url=${encodedUrl}`;
      return match.replace(url, proxyUrl);
    }
    return match;
  });
  
  // 替换 <enclosure> 标签中 url 属性的内容
  modifiedContent = modifiedContent.replace(/<enclosure([^>]+)url\s*=\s*["']([^"']+)["']([^>]*)>/gi, (match, before, url, after) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const encodedUrl = encodeURIComponent(url);
      const proxyUrl = `${proxyHost}/proxy?url=${encodedUrl}`;
      return `<enclosure${before}url="${proxyUrl}"${after}>`;
    }
    return match;
  });
  
  return modifiedContent;
}

app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  try {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'any-proxy/1.0.0'
      }
    };
    
    const proxyReq = client.request(options, (proxyRes) => {
      const contentType = proxyRes.headers['content-type'] || 'text/plain';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (error) => {
      console.error('Proxy request error:', error);
      res.status(500).json({ error: 'Failed to fetch the requested URL' });
    });
    
    proxyReq.setTimeout(10000, () => {
      proxyReq.destroy();
      res.status(408).json({ error: 'Request timeout' });
    });
    
    proxyReq.end();
    
  } catch (error) {
    console.error('URL parsing error:', error);
    res.status(400).json({ error: 'Invalid URL format' });
  }
});

app.get('/rss-proxy', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'RSS URL parameter is required' });
  }
  
  try {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'any-proxy-rss/1.0.0',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    };
    
    const proxyReq = client.request(options, (proxyRes) => {
      const contentType = proxyRes.headers['content-type'] || 'application/xml';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      let data = '';
      proxyRes.setEncoding('utf8');
      
      proxyRes.on('data', (chunk) => {
        data += chunk;
      });
      
      proxyRes.on('end', () => {
        const proxyHost = HOST.endsWith('/') ? HOST.slice(0, -1) : HOST;
        const modifiedContent = replaceRssLinksInContent(data, proxyHost);
        res.send(modifiedContent);
      });
    });
    
    proxyReq.on('error', (error) => {
      console.error('RSS proxy request error:', error);
      res.status(500).json({ error: 'Failed to fetch the RSS feed' });
    });
    
    proxyReq.setTimeout(10000, () => {
      proxyReq.destroy();
      res.status(408).json({ error: 'Request timeout' });
    });
    
    proxyReq.end();
    
  } catch (error) {
    console.error('RSS URL parsing error:', error);
    res.status(400).json({ error: 'Invalid RSS URL format' });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'Any Proxy Server',
    usage: {
      proxy: 'GET /proxy?url=<target_url>',
      rss: 'GET /rss-proxy?url=<rss_url>'
    },
    examples: {
      proxy: '/proxy?url=https://jsonplaceholder.typicode.com/posts/1',
      rss: '/rss-proxy?url=https://feeds.bbci.co.uk/news/rss.xml'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} for usage information`);
});